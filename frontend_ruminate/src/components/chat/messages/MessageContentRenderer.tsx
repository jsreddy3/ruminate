import React, { useMemo } from 'react';
import { MessageRole } from '../../../types/chat';
import { HTMLSanitizer } from '../../../utils/htmlSanitizer';

interface MessageContentRendererProps {
  content: string;
  role: MessageRole;
  isStreaming?: boolean;
  streamingContent?: string | null;
  disableDropCap?: boolean;
}

/**
 * Renders message content with manuscript styling, formatting support, and drop cap.
 * Handles numbered lists, bold text, and maintains scholarly aesthetic.
 */
const MessageContentRenderer: React.FC<MessageContentRendererProps> = ({
  content,
  role,
  isStreaming = false,
  streamingContent = null,
  disableDropCap = false
}) => {

  // Parse and format the content - memoized for performance
  const formatContent = useMemo(() => {
    return (text: string) => {
      if (!text) return null;
      
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
                      <span className="text-base font-serif font-bold text-library-forest-700">
                        {number}
                      </span>
                    </div>
                    
                    {/* Content with scholarly styling */}
                    <div className="flex-1 space-y-2">
                      <h4 className="font-serif font-bold text-library-forest-700 text-xl leading-relaxed break-words overflow-wrap-anywhere">
                        {boldText}
                      </h4>
                      <p className="font-serif text-reading-primary leading-relaxed text-xl pl-1 break-words overflow-wrap-anywhere">
                        {description.trim()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        } else {
          // Regular paragraph - format bold, italic text, and links
          // Process markdown links BEFORE plain URLs to avoid conflicts
          let formattedParagraph = paragraph
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-library-forest-700">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="italic text-library-forest-600">$1</em>')
            // Handle parenthetical markdown links first: ([text](url))
            .replace(/\(\[([^\]]+)\]\(([^)]+)\)\)/g, '(<a href="$2" target="_blank" rel="noopener noreferrer" class="text-xs font-mono text-library-forest-600 hover:text-library-forest-800 underline decoration-dotted hover:decoration-solid transition-all duration-200 bg-library-sage-50 hover:bg-library-sage-100 px-1 py-0.5 rounded border border-library-sage-200">$1</a>)')
            // Handle regular markdown links: [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-xs font-mono text-library-forest-600 hover:text-library-forest-800 underline decoration-dotted hover:decoration-solid transition-all duration-200 bg-library-sage-50 hover:bg-library-sage-100 px-1 py-0.5 rounded border border-library-sage-200">$1</a>')
            // Handle plain URLs (but not ones already inside <a> tags)
            .replace(/(?<!href=["'])(https?:\/\/[^\s<>"{}|\\^`[\]()]+)(?![^<]*<\/a>)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-xs font-mono text-library-forest-600 hover:text-library-forest-800 underline decoration-dotted hover:decoration-solid transition-all duration-200 bg-library-sage-50 hover:bg-library-sage-100 px-1 py-0.5 rounded border border-library-sage-200">$1</a>');
          
          // Sanitize the formatted paragraph content
          const sanitizedParagraph = HTMLSanitizer.sanitizeChatContent(formattedParagraph);
          
          return (
            <p 
              key={paragraphIndex} 
              className="font-serif leading-relaxed mb-4 break-words overflow-wrap-anywhere text-xl"
              dangerouslySetInnerHTML={{ __html: sanitizedParagraph }}
            />
          );
        }
      });
    };
  }, []); // Empty deps since it's a pure function factory

  // Determine what content to display
  const displayContent = useMemo(() => {
    if (role === MessageRole.ASSISTANT && isStreaming) {
      // During streaming, show streaming content if available, otherwise show placeholder
      return streamingContent || null;
    }
    // Not streaming, show regular content
    return content;
  }, [role, isStreaming, streamingContent, content]);

  // Handle streaming state for assistant messages
  if (role === MessageRole.ASSISTANT && isStreaming) {
    // If we have streaming content, show it progressively
    if (streamingContent && streamingContent.length > 0) {
      return (
        <div className="relative">
          <div className="font-serif text-xl">
            {formatContent(streamingContent)}
          </div>
        </div>
      );
    }
    
    // Fallback to loading state if no content yet
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-library-forest-400 to-library-forest-600 rounded-full flex items-center justify-center animate-pulse">
          <svg className="w-4 h-4 text-library-cream-50" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12.5,7H11V12.5L15.75,15.1L16.5,13.9L12.5,11.7V7Z"/>
          </svg>
        </div>
        <span className="font-serif italic text-library-forest-600">
          Considering...
        </span>
      </div>
    );
  }

  // Render regular message content (non-streaming)
  const shouldHaveDropCap = !disableDropCap && 
                           role === MessageRole.ASSISTANT && 
                           content && 
                           content.length > 50 && 
                           !content.match(/^\d+\.\s+/);
  
  // Handle empty content gracefully
  if (!content || content.length === 0) {
    // For assistant messages, show a subtle loading state instead of "No content available"
    // This prevents the jarring experience of content disappearing
    if (role === MessageRole.ASSISTANT) {
      return (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-library-forest-400 rounded-full animate-pulse"></div>
          <div className="w-2 h-2 bg-library-forest-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-library-forest-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
        </div>
      );
    }
    // For user messages, empty content might be intentional (e.g., just an image)
    // For system messages, they're usually hidden anyway
    return null;
  }
  
  return (
    <div className="relative">
      {/* Drop cap for long assistant messages (but not for lists) */}  
      {shouldHaveDropCap && (
        <span className="float-left text-5xl leading-[0.8] font-bold mr-2 mt-0.5 text-library-forest-500 drop-shadow-lg">
          {content.charAt(0)}
        </span>
      )}
      
      <div>
        {shouldHaveDropCap ? (
          <div className="text-left">
            {/* Render content starting from second character with better flow */}
            <span className="font-serif text-xl">
              {formatContent(content.slice(1))}
            </span>
          </div>
        ) : (
          <div className="font-serif text-xl">
            {formatContent(content)}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageContentRenderer;