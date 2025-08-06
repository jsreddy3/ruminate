"use client";

import { useState } from 'react';
import { Document } from '@/services/api/document';
import DocumentRow from './DocumentRow';
import { ChevronDownIcon, ChevronRightIcon, FolderIcon, FolderOpenIcon } from '@heroicons/react/24/outline';

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
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
              <p className="text-lg font-serif text-reading-primary truncate">
                {parentDocument.title.replace(/ \(Part \d+ of \d+\)$/, '')}
              </p>
              <p className="text-sm text-reading-muted mt-1">
                {totalPages} pages • {parentDocument.total_chunks} parts
                {processingCount > 0 && ` • ${processingCount} processing`}
                {awaitingCount > 0 && ` • ${awaitingCount} awaiting`}
              </p>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-base text-reading-secondary">
          {formatDate(parentDocument.created_at)}
        </td>
        <td className="px-6 py-4 text-base text-reading-secondary">
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
        <tr key={chunk.id} className="bg-surface-vellum">
          <td colSpan={4} className="pl-16 pr-6 py-2">
            <div 
              className="hover:bg-surface-cream rounded-md transition-colors cursor-pointer p-3"
              onClick={(e) => {
                e.stopPropagation();
                onDocumentClick(chunk);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-reading-muted">
                    Part {(chunk.chunk_index || 0) + 1}
                  </span>
                  <span className="text-sm font-medium text-reading-primary">
                    Pages {((chunk.chunk_index || 0) * 20) + 1}-{Math.min(((chunk.chunk_index || 0) + 1) * 20, totalPages)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {chunk.status === 'READY' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-library-mint-100 text-library-mint-800">
                      Ready
                    </span>
                  ) : chunk.status === 'AWAITING_PROCESSING' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartProcessing(chunk.id);
                      }}
                      className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md text-reading-primary bg-library-gold-100 hover:bg-library-gold-200 transition-colors"
                    >
                      Start Processing
                    </button>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-library-cream-200 text-library-sage-700">
                      {chunk.status.replace(/_/g, ' ').toLowerCase()}
                    </span>
                  )}
                  {onDocumentDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDocumentDelete(chunk.id);
                      }}
                      className="text-library-sage-500 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}