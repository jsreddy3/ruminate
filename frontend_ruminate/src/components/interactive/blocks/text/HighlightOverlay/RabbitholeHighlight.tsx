import React from 'react';
import { RabbitholeHighlight as RabbitholeHighlightType } from '../../../../../services/rabbithole';

interface RabbitholeHighlightProps {
  highlights: RabbitholeHighlightType[];
  onHighlightClick: (id: string, text: string) => void;
}

/**
 * Component that manages the display of rabbithole highlights
 * This doesn't actually render anything visual on its own,
 * but processes the content in TextContent with highlight spans
 */
const RabbitholeHighlight: React.FC<RabbitholeHighlightProps> = ({
  highlights,
  onHighlightClick
}) => {
  // The actual visual rendering happens in the TextContent component
  // This component just processes the highlights and provides the click handler
  
  /**
   * Process content to include highlight spans
   * @param content Original HTML content
   * @returns Processed HTML with highlight spans
   */
  const processContent = (content: string): string => {
    let processedContent = content;
    
    // Escape special characters in the search string for regex
    const escapeRegExp = (string: string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };
    
    // Add highlight spans for each rabbithole highlight
    highlights.forEach(highlight => {
      const escapedText = escapeRegExp(highlight.selected_text);
      const regex = new RegExp(escapedText, 'g');
      
      processedContent = processedContent.replace(
        regex,
        `<span class="rabbithole-highlight" data-rabbithole-id="${highlight.conversation_id}">${highlight.selected_text}</span>`
      );
    });
    
    return processedContent;
  };
  
  // The component itself doesn't render anything visual
  return null;
};

export default RabbitholeHighlight;
export { type RabbitholeHighlightType };
export type { RabbitholeHighlightProps };
