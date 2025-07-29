"use client";

import { useState, useMemo } from 'react';
import { Document } from '@/services/api/document';
import DocumentRow from './DocumentRow';

interface DocumentTableProps {
  documents: Document[];
  onDocumentClick: (document: Document) => void;
  onDocumentDelete?: (documentId: string) => void;
}

type SortField = 'title' | 'created_at' | 'updated_at' | 'status';
type SortDirection = 'asc' | 'desc';

export default function DocumentTable({ documents, onDocumentClick, onDocumentDelete }: DocumentTableProps) {
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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


  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortDirection === 'asc' ? (
      <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th 
              className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('title')}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
                <SortIcon field="title" />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('created_at')}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
                <SortIcon field="created_at" />
              </div>
            </th>
            <th 
              className="px-6 py-3 text-left cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleSort('updated_at')}
            >
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Updated
                <SortIcon field="updated_at" />
              </div>
            </th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedDocuments.map((document) => (
            <DocumentRow
              key={document.id}
              document={document}
              onClick={() => onDocumentClick(document)}
              onDelete={onDocumentDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}