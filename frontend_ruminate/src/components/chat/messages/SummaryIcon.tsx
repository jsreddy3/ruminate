import React from 'react';
import { GeneratedSummary } from '../../../types/chat';

interface SummaryIconProps {
  summaries: GeneratedSummary[];
  onExpand: (summaries: GeneratedSummary[]) => void;
  isExpanded?: boolean;
}

/**
 * Elegant scholarly icon that appears when messages have generated summaries
 */
const SummaryIcon: React.FC<SummaryIconProps> = ({
  summaries,
  onExpand,
  isExpanded = false
}) => {
  const handleClick = () => {
    onExpand(summaries);
  };

  return (
    <div 
      className="group relative flex items-center gap-2 cursor-pointer transition-all duration-300"
      onClick={handleClick}
    >
      {/* Elegant manuscript scroll icon */}
      <div className={`
        relative flex items-center justify-center w-8 h-8 rounded-full
        bg-gradient-to-br from-library-gold-100 to-library-gold-200
        border-2 border-library-gold-300
        shadow-[0_0_10px_rgba(249,207,95,0.3)]
        group-hover:shadow-[0_0_20px_rgba(249,207,95,0.5)]
        group-hover:scale-110
        transition-all duration-300
        ${isExpanded ? 'bg-gradient-to-br from-library-gold-200 to-library-gold-300 shadow-[0_0_15px_rgba(249,207,95,0.6)]' : ''}
      `}>
        {/* Scroll/manuscript icon */}
        <svg 
          className={`w-4 h-4 transition-colors duration-300 ${
            isExpanded ? 'text-library-gold-700' : 'text-library-gold-600 group-hover:text-library-gold-700'
          }`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
          />
        </svg>
        
        {/* Multiple summaries badge */}
        {summaries.length > 1 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-library-mahogany-500 text-library-cream-50 text-xs font-bold rounded-full flex items-center justify-center shadow-sm">
            {summaries.length}
          </div>
        )}
      </div>
      
      {/* Elegant tooltip on hover */}
      <div className="absolute left-full ml-2 px-3 py-2 bg-library-gold-50 border border-library-gold-200 rounded-journal shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-10">
        <div className="font-serif text-sm text-library-gold-700">
          {summaries.length === 1 ? (
            <>
              📜 Conversation Summary
              {summaries[0].summary_range.topic && (
                <div className="text-xs text-library-gold-600 mt-1">
                  Topic: {summaries[0].summary_range.topic}
                </div>
              )}
            </>
          ) : (
            `📚 ${summaries.length} Conversation Summaries`
          )}
        </div>
        
        {/* Tooltip arrow */}
        <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 w-2 h-2 bg-library-gold-50 border-l border-b border-library-gold-200 rotate-45"></div>
      </div>
    </div>
  );
};

export default SummaryIcon;