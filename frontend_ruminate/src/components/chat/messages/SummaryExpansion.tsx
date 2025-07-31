import React, { useState, useEffect } from 'react';
import { GeneratedSummary } from '../../../types/chat';

interface SummaryExpansionProps {
  summaries: GeneratedSummary[];
  onClose: () => void;
  documentId?: string;
}

interface SummaryContent {
  content: string;
  loading: boolean;
  error?: string;
}

/**
 * Elegant expansion component that displays conversation summaries
 */
const SummaryExpansion: React.FC<SummaryExpansionProps> = ({
  summaries,
  onClose,
  documentId
}) => {
  const [selectedSummaryIndex, setSelectedSummaryIndex] = useState(0);
  const [summaryContents, setSummaryContents] = useState<Map<string, SummaryContent>>(new Map());

  // Fetch summary content from block metadata
  const fetchSummaryContent = async (summary: GeneratedSummary): Promise<string> => {
    try {
      if (!documentId) {
        throw new Error('Document ID is required to fetch summary content');
      }

      // Use the document API to fetch block data
      const { documentApi } = await import('../../../services/api/document');
      const block = await documentApi.getBlock(documentId, summary.block_id);
      
      // Extract the summary from block annotations
      const annotationKey = `generated-${summary.note_id}`;
      const annotation = block.metadata?.annotations?.[annotationKey];
      
      if (!annotation || !annotation.note) {
        throw new Error('Summary not found in block metadata');
      }

      return annotation.note;
    } catch (error) {
      console.error('Error fetching summary content:', error);
      throw error;
    }
  };

  // Load summary content when component mounts or summaries change
  useEffect(() => {
    summaries.forEach(async (summary) => {
      if (!summaryContents.has(summary.note_id)) {
        // Set loading state
        setSummaryContents(prev => new Map(prev.set(summary.note_id, { 
          content: '', 
          loading: true 
        })));

        try {
          const content = await fetchSummaryContent(summary);
          setSummaryContents(prev => new Map(prev.set(summary.note_id, { 
            content, 
            loading: false 
          })));
        } catch (error) {
          setSummaryContents(prev => new Map(prev.set(summary.note_id, { 
            content: '', 
            loading: false, 
            error: 'Failed to load summary content' 
          })));
        }
      }
    });
  }, [summaries, documentId]);

  const currentSummary = summaries[selectedSummaryIndex];
  const currentContent = summaryContents.get(currentSummary.note_id);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mt-4 bg-gradient-to-br from-library-gold-50 via-surface-parchment to-library-cream-100 border-2 border-library-gold-200 rounded-journal shadow-deep backdrop-blur-sm">
      {/* Elegant header */}
      <div className="flex items-center justify-between p-4 border-b border-library-gold-200/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-library-gold-400 to-library-gold-600 rounded-full flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-library-cream-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-serif font-bold text-library-gold-800">Conversation Summary</h3>
            <p className="text-xs text-library-gold-600">
              Generated from {currentSummary.summary_range.message_count} messages
            </p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full hover:bg-library-gold-200 flex items-center justify-center transition-colors duration-200"
        >
          <svg className="w-4 h-4 text-library-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Multiple summaries tabs */}
      {summaries.length > 1 && (
        <div className="flex gap-1 p-2 border-b border-library-gold-200/30">
          {summaries.map((summary, index) => (
            <button
              key={summary.note_id}
              onClick={() => setSelectedSummaryIndex(index)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                index === selectedSummaryIndex
                  ? 'bg-library-gold-200 text-library-gold-800 shadow-sm'
                  : 'text-library-gold-600 hover:bg-library-gold-100'
              }`}
            >
              {summary.summary_range.topic || `Summary ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Summary metadata */}
      <div className="px-4 py-3 bg-gradient-to-r from-library-gold-50/50 to-transparent border-b border-library-gold-200/30">
        <div className="flex flex-wrap gap-4 text-sm text-library-gold-700">
          {currentSummary.summary_range.topic && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span className="font-medium">Topic:</span>
              <span>{currentSummary.summary_range.topic}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="font-medium">{currentSummary.summary_range.message_count} messages</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatDate(currentSummary.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Summary content */}
      <div className="p-4">
        {currentContent?.loading ? (
          <div className="flex items-center gap-3 text-library-gold-600">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="font-serif">Loading summary...</span>
          </div>
        ) : currentContent?.error ? (
          <div className="flex items-center gap-3 text-library-mahogany-600 bg-library-mahogany-50 p-3 rounded-lg border border-library-mahogany-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-serif">{currentContent.error}</span>
          </div>
        ) : (
          <div className="prose prose-sm max-w-none">
            <div 
              className="font-serif text-reading-primary leading-relaxed whitespace-pre-wrap"
              style={{
                textShadow: '0 1px 2px rgba(0,0,0,0.1)',
                lineHeight: '1.7'
              }}
            >
              {currentContent?.content || 'No summary content available.'}
            </div>
          </div>
        )}
      </div>

      {/* Elegant footer with ornamental border */}
      <div className="border-t border-library-gold-200/50 p-2">
        <div className="w-full h-1 bg-gradient-to-r from-transparent via-library-gold-300 to-transparent opacity-30"></div>
      </div>
    </div>
  );
};

export default SummaryExpansion;