"use client";

import { Document } from '@/services/api/document';
import { formatDistanceToNow } from 'date-fns';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface DocumentRowProps {
  document: Document;
  onClick: () => void;
  onDelete?: (documentId: string) => void;
}

export default function DocumentRow({ document, onClick, onDelete }: DocumentRowProps) {
  const [isHovering, setIsHovering] = useState(false);
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '-';
    }
  };

  const getStatusIcon = () => {
    switch (document.status) {
      case 'READY':
        return (
          <div className="w-2 h-2 bg-green-500 rounded-full" />
        );
      case 'PROCESSING':
        return (
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        );
      case 'ERROR':
        return (
          <div className="w-2 h-2 bg-red-500 rounded-full" />
        );
      default:
        return (
          <div className="w-2 h-2 bg-gray-400 rounded-full" />
        );
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    onDelete?.(document.id);
  };

  return (
    <tr 
      className="hover:bg-gray-50 cursor-pointer transition-colors group"
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          {/* PDF Icon */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
            </div>
          </div>
          
          {/* Document Name */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              {document.title}
            </h3>
            {getStatusIcon()}
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4 text-sm text-gray-500">
        {formatDate(document.created_at)}
      </td>
      
      <td className="px-6 py-4 text-sm text-gray-500">
        {formatDate(document.updated_at)}
      </td>
      
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          {/* Delete Button - shown on hover */}
          {onDelete && isHovering && (
            <button
              onClick={handleDeleteClick}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
              title="Delete document"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          )}
          
          {/* Arrow Icon */}
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </td>
    </tr>
  );
}