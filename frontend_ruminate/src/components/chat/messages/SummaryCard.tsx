import React, { useState, useEffect } from 'react';
import { GeneratedSummary, MessageRole } from '../../../types/chat';
import MessageContentRenderer from './MessageContentRenderer';

interface SummaryCardProps {
  summary: GeneratedSummary;
}

/**
 * A beautiful card that displays a conversation summary in the chat flow
 */
const SummaryCard: React.FC<SummaryCardProps> = ({
  summary
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mb-3 px-4">
      <div className="max-w-[60%] mx-auto">
        {/* Compact summary card */}
        <div 
          className="bg-gradient-to-br from-library-gold-50 to-library-cream-100 border border-library-gold-200 rounded-lg shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-library-gold-300"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {/* Compact header */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              {/* Small icon */}
              <div className="w-6 h-6 bg-gradient-to-br from-library-gold-400 to-library-gold-500 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              
              <div>
                <h4 className="font-serif font-medium text-library-gold-800 text-sm">
                  Summary
                </h4>
              </div>
            </div>
            
            {/* Simple expand indicator */}
            <svg 
              className={`w-4 h-4 text-library-gold-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Summary content */}
          {isExpanded && (
            <div className="p-3 border-t border-library-gold-200">
              {summary.summary_content ? (
                <div className="text-sm">
                  <MessageContentRenderer
                    content={summary.summary_content}
                    role={MessageRole.ASSISTANT}
                    isStreaming={false}
                    streamingContent={null}
                    disableDropCap={true}
                  />
                </div>
              ) : (
                <div className="text-sm text-library-mahogany-600 italic">
                  This summary was generated before content storage was implemented. Please generate a new summary to see the content.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SummaryCard;