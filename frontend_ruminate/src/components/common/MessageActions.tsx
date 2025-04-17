import { useState } from 'react';
import { BookOpen, Eye } from 'lucide-react';
import { useNotes } from '../../hooks/useNotes';
import { Message } from '../../types/chat';
import { Notes } from '../../types/notes';

interface MessageActionsProps {
  message: Message;
  documentId: string;
  blockId: string;
  conversationId: string;
  blockSequenceNo?: number;
  className?: string;
  onNoteGenerated?: (note: Notes) => void;
  onSwitchToNotesTab?: () => void; // New callback to switch to notes tab
}

export default function MessageActions({
  message,
  documentId,
  blockId,
  conversationId,
  blockSequenceNo,
  className = '',
  onNoteGenerated,
  onSwitchToNotesTab
}: MessageActionsProps) {
  const { isGenerating, generateNote } = useNotes();
  const [showTooltip, setShowTooltip] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatingToast, setGeneratingToast] = useState(false);
  const [generatedNote, setGeneratedNote] = useState<Notes | null>(null);

  const handleGenerateNote = async () => {
    if (isGenerating) return;
    
    // Show generating toast
    setGeneratingToast(true);
    
    try {
      const note = await generateNote({
        documentId,
        blockId,
        conversationId,
        messageId: message.id,
        blockSequenceNo
      });
      
      // Hide generating toast
      setGeneratingToast(false);
      
      // Store the generated note
      setGeneratedNote(note);
      
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Call the callback if provided
      if (onNoteGenerated) {
        onNoteGenerated(note);
      }
    } catch (error) {
      console.error('Failed to generate note:', error);
      setGeneratingToast(false);
    }
  };

  const handleViewNote = () => {
    if (onSwitchToNotesTab) {
      onSwitchToNotesTab();
    }
  };

  return (
    <>
      {/* Note Generation Button */}
      <div className={`relative ${className}`}>
        {!generatedNote ? (
          <button
            onClick={handleGenerateNote}
            disabled={isGenerating}
            className="text-neutral-400 hover:text-indigo-600 transition-colors duration-200 p-1 rounded-full hover:bg-neutral-100"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="Generate note from message"
          >
            <BookOpen className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleViewNote}
            className="text-indigo-600 hover:text-indigo-700 transition-colors duration-200 p-1 rounded-full hover:bg-indigo-50"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label="View generated note"
          >
            <Eye className="w-4 h-4" />
          </button>
        )}
        
        {showTooltip && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 text-white text-xs rounded whitespace-nowrap z-10">
            {isGenerating ? 'Generating note...' : generatedNote ? 'View note' : 'Generate note'}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-neutral-800"></div>
          </div>
        )}
        
        {success && (
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-green-600 text-white text-xs rounded whitespace-nowrap z-10 animate-fade-in-out">
            Note created!
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-green-600"></div>
          </div>
        )}
      </div>

      {/* Generating Note Toast - Fixed position at the bottom of the screen */}
      {generatingToast && (
        <div className="fixed bottom-4 right-4 bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2 animate-fade-in">
          <div className="flex-shrink-0">
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <div className="font-medium">Generating note...</div>
        </div>
      )}
    </>
  );
}
