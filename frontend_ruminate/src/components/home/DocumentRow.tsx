"use client";

import { Document, documentApi } from '@/services/api/document';
import { formatDistanceToNow } from 'date-fns';
import { TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface DocumentRowProps {
  document: Document;
  onClick: () => void;
  onDelete?: (documentId: string) => void;
  onStartProcessing?: (documentId: string) => void;
  onUpdate?: (document: Document) => void;
}

export default function DocumentRow({ document, onClick, onDelete, onStartProcessing, onUpdate }: DocumentRowProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(document.title);
  const [isSaving, setIsSaving] = useState(false);
  
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
      case 'PROCESSING_MARKER':
        return (
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        );
      case 'AWAITING_PROCESSING':
        return (
          <div className="w-2 h-2 bg-blue-500 rounded-full" />
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

  const handleProcessClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    if (onStartProcessing) {
      onStartProcessing(document.id);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditedTitle(document.title);
  };

  const handleSaveTitle = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    
    if (editedTitle.trim() === '' || editedTitle === document.title) {
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      const updatedDoc = await documentApi.updateDocument(document.id, { title: editedTitle.trim() });
      onUpdate?.(updatedDoc);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update document title:', error);
      alert('Failed to update document title');
      setEditedTitle(document.title);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setIsEditing(false);
    setEditedTitle(document.title);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleSaveTitle(e);
    } else if (e.key === 'Escape') {
      handleCancelEdit(e);
    }
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
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                onBlur={handleSaveTitle}
                disabled={isSaving}
                className="text-sm font-medium text-gray-900 bg-white border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 flex-1"
                autoFocus
              />
            ) : (
              <>
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {document.title}
                </h3>
                {/* Edit Button - right next to title */}
                {isHovering && (
                  <button
                    onClick={handleEditClick}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors rounded-full hover:bg-blue-50 flex-shrink-0"
                    title="Edit document name"
                  >
                    <PencilIcon className="w-3 h-3" />
                  </button>
                )}
                {getStatusIcon()}
              </>
            )}
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
          {/* Process Button - shown for AWAITING_PROCESSING status */}
          {document.status === 'AWAITING_PROCESSING' && (
            <button
              onClick={handleProcessClick}
              className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              title="Start processing this chunk"
            >
              Process
            </button>
          )}
          
          {/* Delete Button - shown on hover */}
          {onDelete && isHovering && document.status !== 'PROCESSING' && document.status !== 'PROCESSING_MARKER' && !isEditing && (
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