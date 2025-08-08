import React, { useEffect, useRef, useState } from 'react';
import { MathJax } from 'better-react-mathjax';
import { getBlockTypeStyles, baseTextStyles, containerStyles } from './textStyles';
import { HTMLSanitizer } from '../../../../utils/htmlSanitizer';

interface TextWithMathProps {
  htmlContent: string;
  blockType: string;
  processedContent: string;
  onClickHighlight: (e: React.MouseEvent) => void;
  getBlockClassName?: (blockType?: string) => string;
  customStyle?: React.CSSProperties & { seamless?: boolean };
  onMathRendered?: () => void;
  // New: for logging/diagnostics
  blockId?: string;
  documentId?: string;
}

class MathErrorBoundary extends React.Component<React.PropsWithChildren<{ fallback: React.ReactNode; tag: string }>, { hasError: boolean }>{
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error(`[MathJax][ErrorBoundary]`, this.props.tag, error, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children as React.ReactNode;
  }
}

/**
 * TextWithMath renders HTML content with embedded LaTeX math.
 * It processes <math> tags and renders them using MathJax.
 */
const TextWithMath = React.forwardRef<HTMLDivElement, TextWithMathProps>(
  (
    {
      blockType,
      processedContent,
      onClickHighlight,
      getBlockClassName = () => '',
      customStyle,
      onMathRendered,
      blockId,
      documentId
    },
    ref
  ) => {
    const tag = `[doc:${documentId || '-'} block:${blockId || '-'}]`;
    const [processedMathContent, setProcessedMathContent] = useState('');
    const [mathRendered, setMathRendered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hostRef = (ref as React.RefObject<HTMLDivElement>) || containerRef;

    // Visibility + stability gating
    const [isVisible, setIsVisible] = useState(false);
    const [canTypeset, setCanTypeset] = useState(false);
    const visibleSinceRef = useRef<number>(0);
    const stableTimerRef = useRef<number | null>(null);

    // Version token to ignore late callbacks
    const typesetVersionRef = useRef<number>(0);

    useEffect(() => {
      // Process the content to convert <math> tags to MathJax format
      let content = processedContent;
      const hadInline = /<math\s+display="inline">/.test(content);
      const hadBlock = /<math(?:\s+display="block")?>/.test(content);
      content = content.replace(/<math\s+display="inline">(.*?)<\/math>/g, (_, math) => `\\(${math}\\)`);
      content = content.replace(/<math(?:\s+display="block")?>(.*?)<\/math>/g, (_, math) => `\\[${math}\\]`);
      const sanitized = HTMLSanitizer.sanitizePDFContent(content);
      setProcessedMathContent(sanitized);
      typesetVersionRef.current += 1;
      // eslint-disable-next-line no-console
      console.debug(`[MathJax] processed`, tag, { hadInline, hadBlock, len: sanitized.length, version: typesetVersionRef.current });
    }, [processedContent]);

    // IntersectionObserver to detect actual visibility
    useEffect(() => {
      const el = hostRef.current;
      if (!el) return;
      const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        const now = performance.now();
        const ratio = entry?.intersectionRatio || 0;
        const intersecting = Boolean(entry && entry.isIntersecting && ratio >= 0.75);
        setIsVisible(intersecting);
        if (intersecting) {
          if (visibleSinceRef.current === 0) visibleSinceRef.current = now;
        } else {
          visibleSinceRef.current = 0;
          setCanTypeset(false);
        }
        // eslint-disable-next-line no-console
        console.debug(`[MathJax] visibility`, tag, { intersecting, ratio, now });
      }, { root: null, threshold: [0, 0.25, 0.5, 0.75, 1] });
      observer.observe(el);
      return () => observer.disconnect();
    }, [hostRef]);

    // Require: node connected + visible for 250ms before enabling MathJax
    useEffect(() => {
      const el = hostRef.current;
      if (!el) return;
      if (!isVisible || !el.isConnected) {
        if (stableTimerRef.current) window.clearTimeout(stableTimerRef.current);
        setCanTypeset(false);
        return;
      }
      if (stableTimerRef.current) window.clearTimeout(stableTimerRef.current);
      stableTimerRef.current = window.setTimeout(() => {
        const stillAttached = Boolean(hostRef.current && hostRef.current.isConnected);
        const stillVisible = isVisible;
        setCanTypeset(stillAttached && stillVisible);
        // eslint-disable-next-line no-console
        console.debug(`[MathJax] canTypeset`, tag, { stillAttached, stillVisible });
      }, 250);
      return () => {
        if (stableTimerRef.current) window.clearTimeout(stableTimerRef.current);
      };
    }, [isVisible, hostRef, processedMathContent]);

    useEffect(() => () => {
      // on unmount, prevent late typeset callbacks from acting
      typesetVersionRef.current += 1;
      // eslint-disable-next-line no-console
      console.debug(`[MathJax] unmount`, tag, { version: typesetVersionRef.current });
    }, []);

    // Merge styles in order of precedence
    const mergedStyles = {
      ...(customStyle?.seamless ? {} : containerStyles),
      ...baseTextStyles,
      ...getBlockTypeStyles(blockType),
      ...customStyle,
    };

    // Handle MathJax rendering completion
    const handleMathRendered = () => {
      const el = hostRef.current;
      const v = typesetVersionRef.current;
      // eslint-disable-next-line no-console
      console.debug(`[MathJax] onTypeset`, tag, { attached: Boolean(el && el.isConnected), version: v });
      if (!el || !el.isConnected) return;
      if (!mathRendered) {
        setMathRendered(true);
        setTimeout(() => {
          onMathRendered?.();
        }, 100);
      }
    };

    const plain = <div dangerouslySetInnerHTML={{ __html: processedMathContent }} />;

    return (
      <div
        className={`text-renderer ${getBlockClassName(blockType)}`}
        ref={hostRef}
        onClick={onClickHighlight}
        style={mergedStyles}
      >
        {canTypeset ? (
          <MathErrorBoundary fallback={plain} tag={tag}>
            <MathJax key={processedMathContent} hideUntilTypeset="first" onTypeset={handleMathRendered}>
              {plain}
            </MathJax>
          </MathErrorBoundary>
        ) : (
          plain
        )}
      </div>
    );
  }
);

TextWithMath.displayName = 'TextWithMath';

export default TextWithMath;