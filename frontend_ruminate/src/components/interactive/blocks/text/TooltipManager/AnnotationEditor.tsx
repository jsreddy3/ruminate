import React, { useRef, useEffect, useState } from 'react';
import { X, FileText, Trash2, Save } from 'lucide-react';

interface AnnotationEditorProps {
  isVisible: boolean;
  position: { x: number, y: number };
  selectedText: string;
  textStartOffset: number;
  textEndOffset: number;
  documentId: string;
  blockId: string;
  existingAnnotation?: {
    id: string;
    note: string;
    created_at: string;
    updated_at: string;
  };
  onClose: () => void;
  onSave: (note: string) => void;
  onDelete?: () => void;
}

const AnnotationEditor: React.FC<AnnotationEditorProps> = ({
  isVisible,
  position,
  selectedText,
  textStartOffset,
  textEndOffset,
  documentId,
  blockId,
  existingAnnotation,
  onClose,
  onSave,
  onDelete
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState(existingAnnotation?.note || '');
  const [isSaving, setIsSaving] = useState(false);

  // Close when clicking outside
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Focus textarea when popup opens
  useEffect(() => {
    if (isVisible && textareaRef.current) {
      textareaRef.current.focus();
      // If editing existing annotation, select all text
      if (existingAnnotation) {
        textareaRef.current.select();
      }
    }
  }, [isVisible, existingAnnotation]);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  // Calculate initial position - ensure it's visible within viewport
  const getInitialPosition = () => {
    let x = position.x;
    let y = position.y + 30; // Position below the selection
    
    // Keep within bounds with default size
    const defaultWidth = 350;
    const defaultHeight = 200;
    
    if (x + defaultWidth > window.innerWidth) {
      x = window.innerWidth - defaultWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }
    
    if (y + defaultHeight > window.innerHeight) {
      y = position.y - defaultHeight - 10; // Position above the selection
    }
    
    return { x, y };
  };

  const { x, y } = getInitialPosition();

  const handleSave = async () => {
    if (!note.trim()) {
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(note.trim());
      // Small delay before closing to ensure save is complete
      setTimeout(() => {
        onClose();
      }, 50);
    } catch (error) {
      console.error('Failed to save annotation:', error);
      setIsSaving(false);
      // Could add error handling here
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsSaving(true);
    try {
      await onDelete();
      // Small delay before closing to ensure delete is complete
      setTimeout(() => {
        onClose();
      }, 50);
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div
      ref={popupRef}
      className="annotation-editor fixed bg-white rounded-lg shadow-xl border border-yellow-200 z-50 animate-fadeIn"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        width: '350px',
        maxHeight: '300px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-yellow-100 bg-yellow-50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-yellow-600" />
          <h3 className="font-medium text-yellow-900">
            {existingAnnotation ? 'Edit Annotation' : 'Add Annotation'}
          </h3>
        </div>
        <button 
          onClick={onClose}
          className="text-yellow-500 hover:text-yellow-700 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Selected text preview */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="text-xs text-gray-500 mb-1">Selected text:</div>
        <div className="text-sm text-gray-700 italic">
          "{selectedText.length > 100 ? selectedText.substring(0, 100) + '...' : selectedText}"
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add your annotation here..."
          className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
          disabled={isSaving}
        />
        
        <div className="text-xs text-gray-500 mt-2">
          Press Ctrl+Enter to save quickly
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          {existingAnnotation && onDelete && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              Delete
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !note.trim()}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-yellow-500 text-white hover:bg-yellow-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnnotationEditor;