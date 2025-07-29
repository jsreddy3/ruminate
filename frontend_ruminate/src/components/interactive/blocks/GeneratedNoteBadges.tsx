import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, X, MessageSquare, Grip } from 'lucide-react';

interface GeneratedNote {
  id: string;
  note: string;
  source_conversation_id?: string;
  message_count?: number;
  topic?: string;
  created_at: string;
}

interface GeneratedNoteBadgesProps {
  annotations?: { [key: string]: any };
  onViewConversation?: (conversationId: string) => void;
}

const GeneratedNoteBadges: React.FC<GeneratedNoteBadgesProps> = ({
  annotations = {},
  onViewConversation
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [popupSize, setPopupSize] = useState({ width: 480, height: 360 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 480, height: 360 });
  const popupRef = useRef<HTMLDivElement>(null);

  // Filter generated notes from annotations
  const generatedNotes: GeneratedNote[] = Object.entries(annotations)
    .filter(([key, annotation]) => 
      annotation.is_generated === true && 
      annotation.text_start_offset === -1
    )
    .map(([key, annotation]) => ({
      id: annotation.id,
      note: annotation.note,
      source_conversation_id: annotation.source_conversation_id,
      message_count: annotation.message_count,
      topic: annotation.topic,
      created_at: annotation.created_at
    }));

  const activeNote = generatedNotes.find(note => note.id === activeNoteId);

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
      const newWidth = Math.max(320, resizeStart.width + (e.clientX - resizeStart.x));
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
  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, popupPosition, popupSize]);

  // Early return after all hooks are called
  if (generatedNotes.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Note badges - larger and horizontal */}
      {generatedNotes.map((note, index) => (
        <button
          key={note.id}
          onClick={() => {
            const isOpening = activeNoteId !== note.id;
            setActiveNoteId(activeNoteId === note.id ? null : note.id);
            // Reset position when opening a new note - center on screen
            if (isOpening) {
              const centerX = Math.max(20, (window.innerWidth - popupSize.width) / 2);
              const centerY = Math.max(20, (window.innerHeight - popupSize.height) / 2);
              setPopupPosition({ x: centerX, y: centerY });
            }
          }}
          className={`group relative p-3 rounded-lg transition-all transform hover:scale-105 shadow-lg ${
            activeNoteId === note.id
              ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white shadow-yellow-200'
              : 'bg-gradient-to-br from-amber-100 to-yellow-100 text-amber-800 hover:from-yellow-200 hover:to-yellow-300 border border-yellow-200'
          }`}
          title={`Generated note${note.topic ? `: ${note.topic}` : ''}`}
          style={{
            zIndex: activeNoteId === note.id ? 60 : 50 + index
          }}
        >
          <FileText className="w-5 h-5" />
          
          {/* Note indicator badge */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {index + 1}
          </div>
          
          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-yellow-300 to-transparent opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none" />
        </button>
      ))}

      {/* Draggable and resizable note popup - rendered as portal */}
      {activeNote && createPortal(
        <div
          ref={popupRef}
          className="fixed bg-white rounded-lg shadow-2xl border border-gray-200 select-none backdrop-blur-sm"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            width: `${popupSize.width}px`,
            height: `${popupSize.height}px`,
            zIndex: 999999,
            cursor: isDragging ? 'grabbing' : 'default'
          }}
          onMouseDown={handleMouseDown}
        >
          {/* Draggable Header */}
          <div className="drag-handle px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-yellow-50 to-amber-50 rounded-t-lg cursor-grab active:cursor-grabbing">
            <div className="flex items-center gap-2">
              <Grip className="w-4 h-4 text-gray-400" />
              <FileText className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-gray-900 truncate">
                {activeNote.topic || 'Conversation Note'}
              </span>
            </div>
            <button
              onClick={() => setActiveNoteId(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Resizable Content */}
          <div 
            className="p-4 overflow-y-auto"
            style={{ 
              height: `${popupSize.height - 110}px` // Account for header and footer
            }}
          >
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {activeNote.note}
            </p>
          </div>

          {/* Footer */}
          <div className="absolute bottom-0 left-0 right-0 px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-b-lg">
            <div className="flex items-center gap-3 text-xs">
              {activeNote.message_count && (
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                  {activeNote.message_count} messages
                </span>
              )}
              <span>{new Date(activeNote.created_at).toLocaleDateString()}</span>
            </div>
            {activeNote.source_conversation_id && onViewConversation && (
              <button
                onClick={() => onViewConversation(activeNote.source_conversation_id!)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors text-xs px-2 py-1 rounded hover:bg-blue-50"
              >
                <MessageSquare className="w-3 h-3" />
                View Chat
              </button>
            )}
          </div>

          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute bottom-1 right-1 w-0 h-0 border-l-2 border-b-2 border-gray-400"></div>
            <div className="absolute bottom-0.5 right-2 w-0 h-0 border-l-2 border-b-2 border-gray-400"></div>
            <div className="absolute bottom-2 right-0.5 w-0 h-0 border-l-2 border-b-2 border-gray-400"></div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default GeneratedNoteBadges;