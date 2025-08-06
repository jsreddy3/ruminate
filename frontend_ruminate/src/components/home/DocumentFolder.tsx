"use client";

import { useState } from 'react';
import { Document } from '@/services/api/document';
import { FolderIcon, FolderOpenIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface DocumentFolderProps {
  parentDocument: Document;
  chunks: Document[];
  onDocumentClick: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onDocumentUpdate?: (document: Document) => void;
  onStartProcessing: (documentId: string) => void;
  isOnboardingActive?: boolean;
  navigatingDocId?: string | null;
}

export default function DocumentFolder({
  parentDocument,
  chunks,
  onDocumentClick,
  onDocumentDelete,
  onDocumentUpdate,
  onStartProcessing,
  isOnboardingActive,
  navigatingDocId
}: DocumentFolderProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort chunks by chunk_index
  const sortedChunks = [...chunks].sort((a, b) => (a.chunk_index || 0) - (b.chunk_index || 0));

  // Calculate total pages (assuming 20 pages per chunk)
  const totalPages = (parentDocument.total_chunks || 1) * 20;

  // Get status summary
  const readyCount = sortedChunks.filter(c => c.status === 'READY').length;
  const processingCount = sortedChunks.filter(c => 
    c.status === 'PROCESSING_MARKER' || c.status === 'ANALYZING_CONTENT'
  ).length;
  const awaitingCount = sortedChunks.filter(c => c.status === 'AWAITING_PROCESSING').length;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '-';
    }
  };

  const getStatusIcon = () => {
    // If all chunks are ready
    if (readyCount === sortedChunks.length) {
      return <div className="w-2 h-2 bg-library-forest-500 rounded-full" />;
    }
    // If any are processing
    if (processingCount > 0) {
      return <div className="w-2 h-2 bg-library-gold-500 rounded-full animate-pulse" />;
    }
    // If any are awaiting
    if (awaitingCount > 0) {
      return <div className="w-2 h-2 bg-library-sage-500 rounded-full" />;
    }
    // Default
    return <div className="w-2 h-2 bg-library-sage-400 rounded-full" />;
  };

  return (
    <>
      {/* Folder row */}
      <tr
        className={`hover:bg-surface-cream cursor-pointer transition-all duration-200 ${
          isOnboardingActive ? 'hover:bg-library-gold-200' : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-6 flex justify-center">
              {isExpanded ? (
                <FolderOpenIcon className="h-6 w-6 text-library-gold-600" />
              ) : (
                <FolderIcon className="h-6 w-6 text-library-gold-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-serif font-medium text-reading-primary truncate">
                  {parentDocument.title.replace(/ \(Part \d+ of \d+\)$/, '')}
                </h3>
                {getStatusIcon()}
              </div>
              <p className="text-sm text-reading-muted mt-1">
                {totalPages} pages • {parentDocument.total_chunks} parts
                {processingCount > 0 && ` • ${processingCount} processing`}
                {awaitingCount > 0 && ` • ${awaitingCount} awaiting`}
              </p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-lg text-reading-secondary font-serif">
          {formatDate(parentDocument.created_at)}
        </td>
        <td className="px-6 py-4 text-lg text-reading-secondary font-serif">
          {formatDate(parentDocument.updated_at)}
        </td>
        <td className="px-6 py-4 text-right">
          <div className="flex items-center justify-end gap-2">
            {readyCount === sortedChunks.length ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-library-mint-100 text-library-mint-800">
                Ready
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-library-gold-100 text-library-gold-800">
                {readyCount}/{sortedChunks.length} Ready
              </span>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded chunks */}
      {isExpanded && sortedChunks.map((chunk) => (
        <tr key={chunk.id} className="bg-surface-paper/50 hover:bg-surface-vellum transition-colors">
          <td className="pl-12 pr-6 py-3" colSpan={3}>
            <div 
              className="flex items-center justify-between cursor-pointer group"
              onClick={(e) => {
                e.stopPropagation();
                onDocumentClick(chunk);
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 flex justify-center">
                  <div className="w-1.5 h-1.5 bg-library-sage-400 rounded-full"></div>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <span className="text-base font-medium text-reading-primary">
                      Part {(chunk.chunk_index || 0) + 1}
                    </span>
                    <span className="text-sm text-reading-muted">
                      Pages {((chunk.chunk_index || 0) * 20) + 1}-{Math.min(((chunk.chunk_index || 0) + 1) * 20, totalPages)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-reading-secondary">
                    <span>Created {formatDate(chunk.created_at)}</span>
                    <span>•</span>
                    <span>Updated {formatDate(chunk.updated_at)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {chunk.status === 'READY' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-library-mint-100 text-library-mint-800">
                    Ready
                  </span>
                ) : chunk.status === 'AWAITING_PROCESSING' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartProcessing(chunk.id);
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-library-gold-500 hover:bg-library-gold-600 transition-colors"
                  >
                    Process
                  </button>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-library-cream-200 text-library-sage-700">
                    {chunk.status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                )}
                {onDocumentDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDocumentDelete(chunk.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-library-sage-400 hover:text-red-600 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </td>
          <td className="px-6 py-3">
            {/* Empty cell for alignment */}
          </td>
        </tr>
      ))}
    </>
  );
}