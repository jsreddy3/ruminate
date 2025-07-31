import React from 'react';
import { MessageRole } from '../../../types/chat';

interface MessageContentRendererProps {
  content: string;
  role: MessageRole;
  isStreaming?: boolean;
  streamingContent?: string | null;
}

/**
 * Renders message content with manuscript styling, formatting support, and drop cap.
 * Handles numbered lists, bold text, and maintains scholarly aesthetic.
 */
const MessageContentRenderer: React.FC<MessageContentRendererProps> = ({
  content,
  role,
  isStreaming = false,
  streamingContent = null
}) => {
  // Handle streaming state for assistant messages
  if (role === MessageRole.ASSISTANT && isStreaming) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-library-forest-400 to-library-forest-600 rounded-full flex items-center justify-center animate-pulse">
          <svg className="w-4 h-4 text-library-cream-50" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12.5,7H11V12.5L15.75,15.1L16.5,13.9L12.5,11.7V7Z"/>
          </svg>
        </div>
        <span className="font-serif italic text-library-forest-600">
          {streamingContent || 'Considering...'}
        </span>
      </div>
    );
  }

  // Parse and format the content
  const formatContent = (text: string) => {
    // Split content into paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    
    return paragraphs.map((paragraph, paragraphIndex) => {
      // Check if this paragraph contains a numbered list
      const listItemRegex = /^(\d+)\.\s+\*\*(.*?)\*\*:\s*(.*?)(?=\n\d+\.\s+\*\*|\n\s*$|$)/gs;
      const matches = [...paragraph.matchAll(listItemRegex)];
      
      if (matches.length > 0) {
        // This is a numbered list with bold headers
        return (
          <div key={paragraphIndex} className="space-y-4 mt-5 mb-6">
            {matches.map((match, index) => {
              const [, number, boldText, description] = match;
              return (
                <div key={index} className="flex gap-4 items-start">
                  {/* Elegant number styling */}
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-library-forest-100 to-library-forest-200 rounded-full flex items-center justify-center border border-library-forest-300 shadow-paper">
                    <span className="text-sm font-serif font-bold text-library-forest-700">
                      {number}
                    </span>
                  </div>
                  
                  {/* Content with scholarly styling */}
                  <div className="flex-1 space-y-2">
                    <h4 className="font-serif font-bold text-library-forest-700 text-base leading-relaxed">
                      {boldText}
                    </h4>
                    <p className="font-serif text-reading-primary leading-relaxed text-base pl-1">
                      {description.trim()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        );
      } else {
        // Regular paragraph - format bold and italic text
        let formattedParagraph = paragraph
          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-library-forest-700">$1</strong>')
          .replace(/\*(.*?)\*/g, '<em class="italic text-library-forest-600">$1</em>');
        
        return (
          <p 
            key={paragraphIndex} 
            className="font-serif leading-relaxed mb-4"
            dangerouslySetInnerHTML={{ __html: formattedParagraph }}
          />
        );
      }
    });
  };

  // Render regular message content
  const shouldHaveDropCap = role === MessageRole.ASSISTANT && content.length > 50 && !content.match(/^\d+\.\s+/);
  
  return (
    <div className="relative">
      {/* Drop cap for long assistant messages (but not for lists) */}  
      {shouldHaveDropCap && (
        <span className="float-left text-5xl leading-[0.8] font-bold mr-2 mt-0.5 text-library-forest-500 drop-shadow-lg">
          {content.charAt(0)}
        </span>
      )}
      
      <div className={shouldHaveDropCap ? "" : ""}>
        {shouldHaveDropCap ? (
          <div className="text-left">
            {/* Render content starting from second character with better flow */}
            <span className="font-serif">
              {formatContent(content.slice(1))}
            </span>
          </div>
        ) : (
          <div className="font-serif">
            {formatContent(content)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageContentRenderer;