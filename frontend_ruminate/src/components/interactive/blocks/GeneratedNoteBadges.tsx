import React, { useState } from 'react';
import { MessageSquare, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';
import BasePopover from '../../common/BasePopover';
import MessageContentRenderer from '../../chat/messages/MessageContentRenderer';

interface GeneratedNote {
  id: string;
  note: string;
  source_conversation_id?: string;
  from_message_id?: string; // NEW: ID of the message that generated this summary
  message_count?: number;
  topic?: string;
  created_at: string;
}

interface GeneratedNoteBadgesProps {
  annotations?: { [key: string]: any };
  onViewConversation?: (conversationId: string, messageId?: string) => void;
}

const GeneratedNoteBadges: React.FC<GeneratedNoteBadgesProps> = ({
  annotations = {},
  onViewConversation
}) => {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [previousNoteCount, setPreviousNoteCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);

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

  // Detect when a new note is added and trigger celebration
  React.useEffect(() => {
    if (generatedNotes.length > previousNoteCount && previousNoteCount > 0) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
    }
    setPreviousNoteCount(generatedNotes.length);
  }, [generatedNotes.length, previousNoteCount]);

  // Early return after all hooks are called
  
  if (generatedNotes.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Note badges - larger and horizontal */}
      {generatedNotes.map((note, index) => {
        const isNewestNote = index === generatedNotes.length - 1 && showCelebration;
        
        return (
          <motion.button
            key={note.id}
            animate={isNewestNote ? {
              scale: [1, 1.2, 1],
              y: [0, -8, 0],
            } : {}}
            transition={isNewestNote ? {
              duration: 0.6,
              ease: "easeOut"
            } : {}}
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
            } ${isNewestNote ? 'animate-pulse' : ''}`}
            title={`Generated note${note.topic ? `: ${note.topic}` : ''}`}
            style={{
              zIndex: activeNoteId === note.id ? 60 : 50 + index
            }}
          >
            <motion.div
              animate={isNewestNote ? {
                rotate: [0, -5, 5, 0]
              } : {}}
              transition={isNewestNote ? {
                duration: 0.4,
                delay: 0.2
              } : {}}
            >
              <Lightbulb className="w-5 h-5" />
            </motion.div>
            
            {/* Note indicator badge */}
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {index + 1}
            </div>
            
            {/* Subtle glow effect on hover */}
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-yellow-300 to-transparent opacity-0 group-hover:opacity-20 transition-opacity pointer-events-none" />
          </motion.button>
        );
      })}

      {/* Draggable and resizable note popup using BasePopover */}
      {activeNote && (
        <BasePopover
          isVisible={true}
          position={popupPosition}
          onClose={() => setActiveNoteId(null)}
          draggable={true}
          resizable={true}
          initialWidth={700}
          initialHeight={500}
          minWidth={500}
          minHeight={350}
          title={
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-600" />
              <span className="text-yellow-900 truncate">
                {activeNote.topic || 'Conversation Insight'}
              </span>
            </div>
          }
          className="border-gray-200 shadow-2xl backdrop-blur-sm"
        >
          <div className="flex flex-col h-full">
            {/* Assistant Message Style Header */}
            <div className="p-4 border-b border-library-sage-200/50">
              <div className="flex items-center gap-3">
                {/* Role icon with dramatic styling - matching assistant messages */}
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-library-forest-400 to-library-forest-600 shadow-[0_0_15px_rgba(90,115,95,0.4)]">
                  <Lightbulb className="w-5 h-5 text-library-cream-50" />
                </div>
                
                {/* Ornate role title */}
                <div className="flex flex-col">
                  <div className="font-serif font-bold text-base text-library-forest-700">
                    AI Reading Colleague
                  </div>
                  <div className="text-xs text-library-forest-600 font-serif italic">
                    Generated Insight
                  </div>
                </div>
              </div>
            </div>

            {/* Content with Assistant Message Styling - Lightened Background */}
            <div className="p-6 flex-1 overflow-y-auto relative"
              style={{
                background: `
                  linear-gradient(135deg, rgba(90, 115, 95, 0.02) 0%, rgba(121, 135, 121, 0.01) 50%, rgba(254, 252, 247, 1) 100%),
                  radial-gradient(circle at top left, rgba(249, 207, 95, 0.02) 0%, transparent 60%),
                  radial-gradient(circle at bottom right, rgba(175, 95, 55, 0.02) 0%, transparent 60%)
                `
              }}
            >
              {/* Elegant border accent - matching assistant messages */}
              <div className="absolute left-0 top-4 bottom-4 w-1 rounded-full bg-gradient-to-b from-transparent via-library-forest-500 to-transparent"></div>
              
              <div className="pl-4">
                <MessageContentRenderer content={activeNote.note} />
              </div>
            </div>

            {/* Elegant Footer with Manuscript Styling */}
            <div className="px-6 py-3 border-t border-library-sage-200/50 flex items-center justify-between bg-gradient-to-r from-surface-paper to-library-cream-100 rounded-b-lg">
              <div className="flex items-center gap-4 text-xs">
                {activeNote.message_count && (
                  <span className="bg-gradient-to-r from-library-forest-100 to-library-sage-100 text-library-forest-700 px-3 py-1.5 rounded-book border border-library-forest-200 font-serif">
                    {activeNote.message_count} messages
                  </span>
                )}
                <span className="text-library-sage-600 font-serif italic">
                  {new Date(activeNote.created_at).toLocaleDateString()}
                </span>
              </div>
              
              {activeNote.source_conversation_id && onViewConversation && (
                <button
                  onClick={() => onViewConversation(activeNote.source_conversation_id!, activeNote.from_message_id)}
                  className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-library-forest-100 to-library-forest-200 hover:from-library-forest-200 hover:to-library-forest-300 text-library-forest-700 hover:text-library-forest-800 rounded-book transition-all duration-300 shadow-paper hover:shadow-book border border-library-forest-300 font-serif"
                >
                  <MessageSquare className="w-3 h-3 transition-transform group-hover:scale-110" />
                  <span className="text-xs font-medium">View Conversation</span>
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