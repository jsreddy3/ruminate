import React, { useRef, useEffect, useState } from 'react';
import { FileText, Trash2, Save } from 'lucide-react';
import BasePopover from '../../../../common/BasePopover';
import BaseEditor from '../../../../common/BaseEditor';

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [note, setNote] = useState(existingAnnotation?.note || '');
  const [isSaving, setIsSaving] = useState(false);

  // Reset note when opening or changing annotation
  useEffect(() => {
    setNote(existingAnnotation?.note || '');
  }, [existingAnnotation, isVisible]);

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

  const handleSave = async () => {
    if (!note.trim()) return;
    
    setIsSaving(true);
    try {
      await onSave(note.trim());
      onClose();
    } catch (error) {
      console.error('Failed to save annotation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    
    setIsSaving(true);
    try {
      await onDelete();
    } catch (error) {
      console.error('Failed to delete annotation:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const truncatedText = selectedText.length > 20 
    ? selectedText.substring(0, 20) + '...' 
    : selectedText;

  // Custom footer with your original beautiful styling
  const customFooter = (
    <div className="px-4 py-3 border-t border-yellow-100 bg-gradient-to-r from-yellow-25 to-amber-25 rounded-b-lg flex items-center justify-between">
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
  );

  return (
    <BasePopover
      isVisible={isVisible}
      position={position}
      onClose={onClose}
      draggable={true}
      resizable={true}
      initialWidth={420}
      initialHeight="auto"
      minWidth={350}
      minHeight={180}
      title={
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-yellow-600" />
          <span className="text-yellow-900">"{truncatedText}"</span>
        </div>
      }
      className="border-yellow-200 shadow-2xl backdrop-blur-sm"
      offsetY={30}
    >
      <BaseEditor
        showDefaultButtons={false}
        customFooter={customFooter}
      >
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add your annotation here..."
          className="w-full flex-1 px-3 py-3 border border-yellow-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-gray-800 text-sm leading-relaxed bg-yellow-25/30"
          style={{ minHeight: '80px' }}
          disabled={isSaving}
        />
      </BaseEditor>
    </BasePopover>
  );
};

export default AnnotationEditor;