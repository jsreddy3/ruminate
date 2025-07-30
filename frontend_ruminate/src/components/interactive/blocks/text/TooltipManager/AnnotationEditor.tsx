import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Trash2, Save, Grip } from 'lucide-react';

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
  
  // Drag & resize state
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [popupSize, setPopupSize] = useState({ width: 420, height: 280 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 420, height: 280 });

  // Initialize position when opening
  useEffect(() => {
    if (isVisible) {
      const initialPosition = getInitialPosition();
      setPopupPosition(initialPosition);
      setPopupSize({ width: 420, height: 280 }); // Reset size
    }
  }, [isVisible, position]);

  // Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === popupRef.current || (e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - popupPosition.x, y: e.clientY - popupPosition.y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPopupPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (isResizing) {
      const newWidth = Math.max(350, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(240, resizeStart.height + (e.clientY - resizeStart.y));
      setPopupSize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: popupSize.width,
      height: popupSize.height
    });
  };

  // Add global mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, popupPosition, popupSize]);

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
    
    // Keep within bounds with current size
    const currentWidth = popupSize.width;
    const currentHeight = popupSize.height;
    
    if (x + currentWidth > window.innerWidth) {
      x = window.innerWidth - currentWidth - 20;
    }
    if (x < 20) {
      x = 20;
    }
    
    if (y + currentHeight > window.innerHeight) {
      y = position.y - currentHeight - 10; // Position above the selection
    }
    
    return { x, y };
  };

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

  return createPortal(
    <div
      ref={popupRef}
      className="fixed bg-white rounded-lg shadow-2xl border border-yellow-200 select-none backdrop-blur-sm animate-fadeIn"
      style={{
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        width: `${popupSize.width}px`,
        height: `${popupSize.height}px`,
        zIndex: 999999,
        cursor: isDragging ? 'grabbing' : 'default',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 235, 59, 0.1)',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Draggable Header */}
      <div className="drag-handle px-4 py-3 border-b border-yellow-100 flex items-center justify-between bg-gradient-to-r from-yellow-50 to-amber-50 rounded-t-lg cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Grip className="w-4 h-4 text-yellow-400" />
          <FileText size={16} className="text-yellow-600" />
          <h3 className="font-medium text-yellow-900 truncate">
            "{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"
          </h3>
        </div>
        <button 
          onClick={onClose}
          className="text-yellow-500 hover:text-yellow-700 transition-colors p-1 rounded hover:bg-yellow-100 flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
      
      {/* Resizable Content */}
      <div 
        className="p-4 flex flex-col"
        style={{ 
          height: `${popupSize.height - 95}px` // Account for header and footer only
        }}
      >
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add your annotation here..."
          className="w-full flex-1 px-3 py-3 border border-yellow-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-gray-800 text-sm leading-relaxed bg-yellow-25/30"
          disabled={isSaving}
          style={{ minHeight: '80px' }}
        />
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-yellow-100 bg-gradient-to-r from-yellow-25 to-amber-25 rounded-b-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          {existingAnnotation && onDelete && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 font-medium"
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
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-white/80 rounded-lg transition-colors disabled:opacity-50 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !note.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gradient-to-r from-yellow-500 to-yellow-600 text-white hover:from-yellow-600 hover:to-yellow-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg"
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute bottom-1 right-1 w-0 h-0 border-l-2 border-b-2 border-yellow-400"></div>
        <div className="absolute bottom-0.5 right-2 w-0 h-0 border-l-2 border-b-2 border-yellow-400"></div>
        <div className="absolute bottom-2 right-0.5 w-0 h-0 border-l-2 border-b-2 border-yellow-400"></div>
      </div>
    </div>,
    document.body
  );
};

export default AnnotationEditor;