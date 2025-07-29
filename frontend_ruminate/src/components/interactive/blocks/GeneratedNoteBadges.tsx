import React, { useState } from 'react';
import { FileText, X, MessageSquare } from 'lucide-react';

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

  if (generatedNotes.length === 0) {
    return null;
  }

  const activeNote = generatedNotes.find(note => note.id === activeNoteId);

  return (
    <div className="relative flex items-center gap-1">
      {/* Note badges */}
      {generatedNotes.map((note, index) => (
        <button
          key={note.id}
          onClick={() => setActiveNoteId(activeNoteId === note.id ? null : note.id)}
          className={`p-1 rounded-full transition-all ${
            activeNoteId === note.id
              ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
              : 'bg-gray-50 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600 border border-gray-200'
          }`}
          title={`Generated note${note.topic ? `: ${note.topic}` : ''}`}
        >
          <FileText className="w-3 h-3" />
        </button>
      ))}

      {/* Note popup */}
      {activeNote && (
        <div className="absolute top-8 right-0 z-50 w-80 max-h-64 bg-white rounded-lg shadow-lg border border-gray-200">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-gray-900">
                {activeNote.topic || 'Conversation Note'}
              </span>
            </div>
            <button
              onClick={() => setActiveNoteId(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 max-h-40 overflow-y-auto">
            <p className="text-sm text-gray-700 leading-relaxed">
              {activeNote.note}
            </p>
          </div>

          {/* Footer */}
          <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-3">
              {activeNote.message_count && (
                <span>{activeNote.message_count} messages</span>
              )}
              <span>{new Date(activeNote.created_at).toLocaleDateString()}</span>
            </div>
            {activeNote.source_conversation_id && onViewConversation && (
              <button
                onClick={() => onViewConversation(activeNote.source_conversation_id!)}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <MessageSquare className="w-3 h-3" />
                View chat
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneratedNoteBadges;