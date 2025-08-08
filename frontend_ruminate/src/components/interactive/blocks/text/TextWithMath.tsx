import React, { useEffect, useRef, useState } from 'react';
// import { MathJax } from 'better-react-mathjax';
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
    console.error(`[KaTeX][ErrorBoundary]`, this.props.tag, error, info);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children as React.ReactNode;
  }
}

/**
 * TextWithMath renders HTML content with embedded LaTeX math.
 * It processes <math> tags and renders them using KaTeX auto-render.
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
    const hasTypesetRef = useRef(false);
    const [katexProcessed, setKatexProcessed] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const hostRef = (ref as React.RefObject<HTMLDivElement>) || containerRef;

    // Visibility + stability gating
    const visibilityThreshold = customStyle?.seamless ? 0.25 : 0.75;
    const stableDelayMs = customStyle?.seamless ? 0 : 250;
    const [isVisible, setIsVisible] = useState(false);
    const [canTypeset, setCanTypeset] = useState(false);
    const visibleSinceRef = useRef<number>(0);
    const stableTimerRef = useRef<number | null>(null);

    // Version token to ignore late callbacks
    const typesetVersionRef = useRef<number>(0);

    useEffect(() => {
      // Process the content to convert <math> tags to TeX delimiters for KaTeX
      let content = processedContent;
      const hadInline = /<math\s+display="inline">/.test(content);
      const hadBlock = /<math(?:\s+display="block")?>/.test(content);
      const hadExistingInline = /\\\([\s\S]*?\\\)/.test(content);
      const hadExistingBlock = /\\\[[\s\S]*?\\\]/.test(content);
      
      content = content.replace(/<math\s+display="inline">([\s\S]*?)<\/math>/g, (_, math) => `\\(${math}\\)`);
      content = content.replace(/<math(?:\s+display="block")?>([\s\S]*?)<\/math>/g, (_, math) => `\\[${math}\\]`);
      // Normalize micro sign inside TeX delimiters to \mu
      const normalizeMicroInTeX = (tex: string) => tex.replace(/[\u00B5\u03BC]/g, '\\mu');
      content = content.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `\\(${normalizeMicroInTeX(inner)}\\)`);
      content = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `\\[${normalizeMicroInTeX(inner)}\\]`);
      const sanitized = HTMLSanitizer.sanitizePDFContent(content);
      setProcessedMathContent(sanitized);
      hasTypesetRef.current = false; // reset if content changes
      setKatexProcessed(false); // reset KaTeX processed state
      // In seamless mode, skip intersection gating and allow immediate typeset
      if (customStyle?.seamless) {
        setIsVisible(true);
        setCanTypeset(true);
      }
      typesetVersionRef.current += 1;
      // eslint-disable-next-line no-console
      console.debug(`[KaTeX] processed`, tag, { 
        hadInline, 
        hadBlock, 
        hadExistingInline,
        hadExistingBlock,
        len: sanitized.length, 
        version: typesetVersionRef.current, 
        sample: sanitized.substring(0, 400) 
      });
    }, [processedContent]);

    // IntersectionObserver to detect actual visibility
    useEffect(() => {
      if (customStyle?.seamless) return; // skip observer in seamless mode
      const el = hostRef.current;
      if (!el) return;
      const observer = new IntersectionObserver((entries) => {
        const entry = entries[0];
        const now = performance.now();
        const ratio = entry?.intersectionRatio || 0;
        const intersecting = Boolean(entry && entry.isIntersecting && ratio >= visibilityThreshold);
        setIsVisible(intersecting);
        if (intersecting) {
          if (visibleSinceRef.current === 0) visibleSinceRef.current = now;
        } else {
          visibleSinceRef.current = 0;
          // Do not force canTypeset back to false after we already typeset
          if (!hasTypesetRef.current) setCanTypeset(false);
        }
        // eslint-disable-next-line no-console
        console.debug(`[KaTeX] visibility`, tag, { intersecting, ratio, now, threshold: visibilityThreshold });
      }, { root: null, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
      observer.observe(el);
      return () => observer.disconnect();
    }, [hostRef, visibilityThreshold, customStyle?.seamless]);

    // Require: node connected + visible for N ms before enabling KaTeX (seamless: 0ms)
    useEffect(() => {
      const el = hostRef.current;
      if (!el) return;
      if (hasTypesetRef.current) return; // already done
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
        console.debug(`[KaTeX] canTypeset`, tag, { stillAttached, stillVisible, delay: stableDelayMs });
      }, stableDelayMs);
      return () => {
        if (stableTimerRef.current) window.clearTimeout(stableTimerRef.current);
      };
    }, [isVisible, hostRef, processedMathContent, stableDelayMs]);

    useEffect(() => () => {
      // on unmount, prevent late typeset callbacks from acting
      typesetVersionRef.current += 1;
      // eslint-disable-next-line no-console
      console.debug(`[KaTeX] unmount`, tag, { version: typesetVersionRef.current });
    }, []);

    // Typeset with KaTeX when allowed
    useEffect(() => {
      if (!canTypeset || hasTypesetRef.current) return;
      const el = hostRef.current;
      if (!el || !el.isConnected) return;
      const myVersion = (typesetVersionRef.current += 1);
      // Defer to ensure DOM has innerHTML applied
      const id = requestAnimationFrame(async () => {
        try {
          // Double-check element is still connected
          if (!el || !el.isConnected) {
            console.debug(`[KaTeX] Element disconnected before render`, tag);
            return;
          }
          
          // Ensure content is actually in the DOM
          if (!el.innerHTML || el.innerHTML.trim() === '') {
            console.debug(`[KaTeX] Empty content, retrying...`, tag);
            // Retry after a short delay if content is empty
            setTimeout(() => {
              if (el && el.isConnected && el.innerHTML && el.innerHTML.trim() !== '') {
                import('katex/contrib/auto-render').then(mod => {
                  const renderMathInElement = (mod as any).default || (mod as any);
                  
                  console.debug(`[KaTeX] Retry: Pre-render content`, tag, { 
                    innerHTML: el.innerHTML.substring(0, 200),
                    hasInlineDelimiters: el.innerHTML.includes('\\('),
                    hasBlockDelimiters: el.innerHTML.includes('\\[')
                  });
                  
                  renderMathInElement(el, {
                    delimiters: [
                      { left: "\\(", right: "\\)", display: false },
                      { left: "\\[", right: "\\]", display: true },
                    ],
                    throwOnError: false,
                    macros: {
                      "\\ul": "\\,\\mathrm{ul}",
                      "\\uL": "\\,\\mathrm{\\mu L}",
                      "\\micro": "\\mu",
                    }
                  });
                  hasTypesetRef.current = true;
                  
                  console.debug(`[KaTeX] Retry: Post-render`, tag, {
                    hasKatexElements: el.querySelectorAll('.katex').length > 0,
                    katexCount: el.querySelectorAll('.katex').length
                  });
                  
                  setKatexProcessed(true);
                  
                  if (!mathRendered) {
                    setMathRendered(true);
                    onMathRendered?.();
                  }
                });
              }
            }, 50);
            return;
          }
          
          const mod = await import('katex/contrib/auto-render');
          const renderMathInElement = (mod as any).default || (mod as any);
          
          // Log the content before KaTeX processes it
          console.debug(`[KaTeX] Pre-render content`, tag, { 
            innerHTML: el.innerHTML.substring(0, 200),
            hasInlineDelimiters: el.innerHTML.includes('\\('),
            hasBlockDelimiters: el.innerHTML.includes('\\[')
          });
          
          renderMathInElement(el, {
            delimiters: [
              { left: "\\(", right: "\\)", display: false },
              { left: "\\[", right: "\\]", display: true },
            ],
            throwOnError: false,
            macros: {
              "\\ul": "\\,\\mathrm{ul}",
              "\\uL": "\\,\\mathrm{\\mu L}",
              "\\micro": "\\mu",
            }
          });
          
          hasTypesetRef.current = true;
          
          // Log the content after KaTeX processes it
          console.debug(`[KaTeX] Post-render`, tag, { 
            attached: Boolean(el && el.isConnected), 
            version: myVersion,
            hasKatexElements: el.querySelectorAll('.katex').length > 0,
            katexCount: el.querySelectorAll('.katex').length
          });
          
          setKatexProcessed(true);
          
          if (!mathRendered) {
            setMathRendered(true);
            setTimeout(() => {
              onMathRendered?.();
            }, 100);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('[KaTeX] render error', tag, error);
        }
      });
      return () => cancelAnimationFrame(id);
    }, [canTypeset, processedMathContent]);

    // Merge styles in order of precedence
    const mergedStyles = {
      ...(customStyle?.seamless ? {} : containerStyles),
      ...baseTextStyles,
      ...getBlockTypeStyles(blockType),
      ...customStyle,
    };

    // Add a data attribute to help debug
    const plain = <div data-has-math={processedMathContent.includes('\\(')} dangerouslySetInnerHTML={{ __html: processedMathContent }} />;

    // Debug re-renders
    useEffect(() => {
      console.debug('[KaTeX] Component rendered/re-rendered', tag, {
        hasProcessedContent: !!processedMathContent,
        katexProcessed,
        mathRendered,
        canTypeset
      });
    });

    // Run KaTeX on every render to ensure math stays rendered
    useEffect(() => {
      if (!processedMathContent || !hostRef.current) return;
      
      // Check if content has math delimiters
      if (processedMathContent.includes('\\(') || processedMathContent.includes('\\[')) {
        const el = hostRef.current;
        
        // Use a longer timeout to ensure DOM is stable
        const timeoutId = setTimeout(async () => {
          if (!el || !el.isConnected) return;
          
          // Check if KaTeX has already rendered
          if (el.querySelector('.katex')) {
            console.debug('[KaTeX] Already rendered, skipping');
            return;
          }
          
          try {
            const mod = await import('katex/contrib/auto-render');
            const renderMathInElement = (mod as any).default || (mod as any);
            
            console.debug('[KaTeX] Running render for math content');
            
            renderMathInElement(el, {
              delimiters: [
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true },
              ],
              throwOnError: false,
              macros: {
                "\\ul": "\\,\\mathrm{ul}",
                "\\uL": "\\,\\mathrm{\\mu L}",
                "\\micro": "\\mu",
              }
            });
            
            console.debug('[KaTeX] Render complete', {
              katexElements: el.querySelectorAll('.katex').length
            });
            
            // Mark that KaTeX has processed the content
            setKatexProcessed(true);
            if (!mathRendered) {
              setMathRendered(true);
              onMathRendered?.();
            }
          } catch (error) {
            console.error('[KaTeX] Render error:', error);
          }
        }, 50); // Use a slightly longer delay
        
        return () => clearTimeout(timeoutId);
      }
    });

    return (
      <div
        className={`text-renderer ${getBlockClassName(blockType)}`}
        ref={hostRef}
        onClick={onClickHighlight}
        style={mergedStyles}
      >
        <MathErrorBoundary fallback={plain} tag={tag}>
          {plain}
        </MathErrorBoundary>
      </div>
    );
  }
);

TextWithMath.displayName = 'TextWithMath';

export default TextWithMath;