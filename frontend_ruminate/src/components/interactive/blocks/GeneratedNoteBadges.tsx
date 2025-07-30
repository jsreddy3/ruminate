import React, { useState } from 'react';
import { MessageSquare, Lightbulb } from 'lucide-react';
import BasePopover from '../../common/BasePopover';

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
              const centerX = Math.max(20, (window.innerWidth - 480) / 2);
              const centerY = Math.max(20, (window.innerHeight - 360) / 2);
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
          <Lightbulb className="w-5 h-5" />
          
          {/* Note indicator badge */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {index + 1}
          </div>
          
          {/* Subtle glow effect on hover */}
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-yellow-300 to-transparent opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none" />
        </button>
      ))}

      {/* Draggable and resizable note popup using BasePopover */}
      {activeNote && (
        <BasePopover
          isVisible={true}
          position={popupPosition}
          onClose={() => setActiveNoteId(null)}
          draggable={true}
          resizable={true}
          initialWidth={480}
          initialHeight={360}
          minWidth={320}
          minHeight={240}
          title={
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              <span className="text-yellow-900 truncate">
                {activeNote.topic || 'Conversation Summary'}
              </span>
            </div>
          }
          className="border-gray-200 shadow-2xl backdrop-blur-sm"
        >
          <div className="flex flex-col h-full">
            {/* Content */}
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {activeNote.note}
              </p>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-b-lg">
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
          </div>
        </BasePopover>
      )}
    </div>
  );
};

export default GeneratedNoteBadges;