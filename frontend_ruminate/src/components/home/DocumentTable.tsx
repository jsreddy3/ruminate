"use client";

import { useState, useMemo } from 'react';
import { Document, documentApi } from '@/services/api/document';
import DocumentRow from './DocumentRow';
import { useProcessing } from '@/contexts/ProcessingContext';

interface DocumentTableProps {
  documents: Document[];
  onDocumentClick: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
  onDocumentUpdate?: (document: Document) => void;
  isOnboardingActive?: boolean; // Whether onboarding mode is active
  navigatingDocId?: string | null; // Document being navigated to
}

type SortField = 'title' | 'created_at' | 'updated_at' | 'status';
type SortDirection = 'asc' | 'desc';

export default function DocumentTable({ documents, onDocumentClick, onDocumentDelete, onDocumentUpdate, isOnboardingActive, navigatingDocId }: DocumentTableProps) {
  // Add glow animation styles
  if (typeof window !== 'undefined' && !document.getElementById('onboarding-glow-styles')) {
    const style = document.createElement('style');
    style.id = 'onboarding-glow-styles';
    style.textContent = `
      @keyframes glow {
        0% {
          box-shadow: 0 0 20px rgba(249, 207, 95, 0.8), 0 0 40px rgba(249, 207, 95, 0.4);
        }
        50% {
          box-shadow: 0 0 30px rgba(249, 207, 95, 1), 0 0 60px rgba(249, 207, 95, 0.6), 0 0 80px rgba(249, 207, 95, 0.3);
        }
        100% {
          box-shadow: 0 0 20px rgba(249, 207, 95, 0.8), 0 0 40px rgba(249, 207, 95, 0.4);
        }
      }
    `;
    document.head.appendChild(style);
  }

  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { startProcessing } = useProcessing();

  const sortedDocuments = useMemo(() => {
    const sorted = [...documents].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';

      // Convert to lowercase for string comparison
      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [documents, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleStartProcessing = async (documentId: string) => {
    try {
      const doc = documents.find(d => d.id === documentId);
      if (doc) {
        // Start processing in the backend
        await documentApi.startProcessing(documentId);
        // Register with global processing context
        startProcessing(documentId, doc.title);
      }
    } catch (error) {
      console.error('Failed to start processing:', error);
      alert('Failed to start processing. Please try again.');
    }
  };


  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-library-sage-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-reading-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-reading-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <>
      <div className="overflow-x-auto relative">
        <table className="w-full">
        <thead className="bg-surface-vellum">
          <tr>
            <th 
              className="px-6 py-3 text-left cursor-pointer hover:bg-surface-aged transition-colors"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center gap-2 text-lg font-medium text-reading-muted uppercase tracking-wider">
                Name
                <SortIcon field="title" />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left cursor-pointer hover:bg-surface-aged transition-colors"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center gap-2 text-lg font-medium text-reading-muted uppercase tracking-wider">
                Created
                <SortIcon field="created_at" />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left cursor-pointer hover:bg-surface-aged transition-colors"
              onClick={() => handleSort('updated_at')}
            >
              <div className="flex items-center gap-2 text-lg font-medium text-reading-muted uppercase tracking-wider">
                Updated
                <SortIcon field="updated_at" />
              </div>
            </th>
            <th className="w-20"></th>
          </tr>
        </thead>
        <tbody 
          className={`divide-y divide-library-cream-300 relative transition-all duration-300 ${
            isOnboardingActive 
              ? 'ring-4 ring-library-gold-400/70 shadow-2xl scale-[1.02]' 
              : 'bg-surface-parchment'
          }`}
          style={isOnboardingActive ? {
            background: 'linear-gradient(135deg, #f9cf5f 0%, #edbe51 100%)',
            animation: 'glow 2s ease-in-out infinite',
            boxShadow: '0 0 25px rgba(249, 207, 95, 0.9), 0 0 50px rgba(249, 207, 95, 0.5)',
            display: 'table-row-group'
          } : {
            background: ''
          }}>
          {sortedDocuments.map((document, index) => (
            <DocumentRow
              key={document.id}
              document={document}
              onClick={() => onDocumentClick(document)}
              onDelete={onDocumentDelete}
              onStartProcessing={handleStartProcessing}
              onUpdate={onDocumentUpdate}
              isOnboardingActive={isOnboardingActive}
              isOnboardingTarget={isOnboardingActive}  // All documents are selectable during onboarding
              isNavigating={navigatingDocId === document.id}
            />
          ))}
        </tbody>
        </table>
      </div>
    </>
  );
}