import React, { useState } from 'react';
import InsightHighlight from './InsightHighlight';
import { RabbitholeHighlight as RabbitholeHighlightType } from '../../../../../services/rabbithole';

interface HighlightOverlayProps {
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  rabbitholeHighlights?: RabbitholeHighlightType[];
  htmlContent: string;
  onRabbitholeClick?: (id: string, text: string) => void;
}

/**
 * HighlightOverlay processes content to include both regular highlights and rabbithole highlights.
 * It also manages displaying insight popups when highlights are clicked.
 */
const HighlightOverlay: React.FC<HighlightOverlayProps> & {
  processContent: (content: string, props: HighlightOverlayProps) => string;
  handleHighlightClick: (e: React.MouseEvent, setActiveInsight: React.Dispatch<React.SetStateAction<string | null>>) => void;
} = ({ 
  highlights = [], 
  rabbitholeHighlights = [],
  htmlContent,
  onRabbitholeClick 
}) => {
  const [activeInsight, setActiveInsight] = useState<string | null>(null);
  
  return (
    <>
      <InsightHighlight 
        insight={activeInsight || ''}
        isVisible={!!activeInsight}
        onClose={() => setActiveInsight(null)}
      />
    </>
  );
};

// Helper to escape RegExp special characters
const escapeRegExp = (string: string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Process content to include highlight spans for both regular and rabbithole highlights
 */
HighlightOverlay.processContent = (content: string, { highlights = [], rabbitholeHighlights = [] }: HighlightOverlayProps) => {
  let processedContent = content;
  
  // Add regular highlights
  highlights.forEach(highlight => {
    const regex = new RegExp(escapeRegExp(highlight.phrase), 'gi');
    processedContent = processedContent.replace(
      regex,
      `<span class="highlight-phrase" data-insight="${highlight.insight}">${highlight.phrase}</span>`
    );
  });
  
  // Add rabbithole highlights
  rabbitholeHighlights.forEach(highlight => {
    const escapedText = escapeRegExp(highlight.selected_text);
    const regex = new RegExp(escapedText, 'g');
    
    processedContent = processedContent.replace(
      regex,
      `<span class="rabbithole-highlight" data-rabbithole-id="${highlight.conversation_id}">${highlight.selected_text}</span>`
    );
  });
  
  return processedContent;
};

/**
 * Handle clicks on highlight spans
 */
HighlightOverlay.handleHighlightClick = (e: React.MouseEvent, setActiveInsight: React.Dispatch<React.SetStateAction<string | null>>) => {
  const target = e.target as HTMLElement;
  
  // Handle clicking on phrase highlights
  if (target.classList.contains('highlight-phrase')) {
    const insight = target.getAttribute('data-insight');
    if (insight) {
      setActiveInsight(insight);
    }
  } 
  // Handle clicking on rabbithole highlights
  else if (target.classList.contains('rabbithole-highlight')) {
    const rabbitholeId = target.getAttribute('data-rabbithole-id');
    if (rabbitholeId) {
      // Pass to parent - parent might open a rabbithole conversation panel
      console.log(`Open rabbithole conversation: ${rabbitholeId}`);
    }
  } else {
    setActiveInsight(null);
  }
};

export default HighlightOverlay;
