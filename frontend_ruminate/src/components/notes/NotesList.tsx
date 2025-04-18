import { useState, useEffect } from 'react';
import { Notes } from '../../types/notes';
import { useNotes } from '../../hooks/useNotes';
// Date formatting helper
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.round(diffMs / 1000);
  const diffMins = Math.round(diffSecs / 60);
  const diffHours = Math.round(diffMins / 60);
  const diffDays = Math.round(diffHours / 24);
  
  // Format based on how recent the date is
  if (diffSecs < 60) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  } else {
    // For older dates, use a standard format
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  }
}

interface NotesListProps {
  documentId: string;
  onNoteSelect?: (note: Notes) => void;
  className?: string;
  blockSequenceMap?: Map<string, number>;
  refetchTrigger?: number; // Simple counter to trigger refetch
}

export default function NotesList({ 
  documentId, 
  onNoteSelect,
  className = '',
  blockSequenceMap,
  refetchTrigger = 0
}: NotesListProps) {
  const { fetchDocumentNotes } = useNotes();
  const [notes, setNotes] = useState<Notes[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notes on mount and whenever refetchTrigger changes
  useEffect(() => {
    async function fetchNotes() {
      setLoading(true);
      setError(null);
      
      try {
        const fetchedNotes = await fetchDocumentNotes(documentId);
        
        // Sort notes by the most reliable ordering available
        const sortedNotes = fetchedNotes.sort((a, b) => {
          // First try using the block_sequence_no if available
          if (a.block_sequence_no !== undefined && b.block_sequence_no !== undefined) {
            return a.block_sequence_no - b.block_sequence_no;
          }
          
          // Then try using the blockSequenceMap if available
          if (blockSequenceMap && a.block_id && b.block_id) {
            const aIndex = blockSequenceMap.get(a.block_id);
            const bIndex = blockSequenceMap.get(b.block_id);
            
            if (aIndex !== undefined && bIndex !== undefined) {
              return aIndex - bIndex;
            }
          }
          
          // Fall back to sorting by creation date (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        setNotes(sortedNotes);
      } catch (err) {
        console.error('Failed to load notes:', err);
        setError('Failed to load notes. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchNotes();
  }, [documentId, refetchTrigger]); // Refetch when documentId or refetchTrigger changes

  if (loading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
          <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
          <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 text-red-600 ${className}`}>
        {error}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className={`p-4 text-neutral-500 ${className}`}>
        No notes have been created for this document yet. 
        <div className="mt-2 text-sm">
          You can create notes by selecting a message in a conversation and clicking the note icon.
        </div>
      </div>
    );
  }

  function truncateContent(content: string, maxLength = 150) {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  return (
    <div className={`notes-list space-y-4 p-4 overflow-y-auto ${className}`}>
      <h2 className="text-lg font-medium text-neutral-800 mb-4 sticky top-0 bg-white py-2 z-10">Document Notes ({notes.length})</h2>
      
      {notes.map((note) => (
        <div 
          key={note.id}
          className="note-item bg-white border border-neutral-200 rounded-lg shadow-sm p-4 hover:border-indigo-300 transition-colors cursor-pointer"
          onClick={() => onNoteSelect && onNoteSelect(note)}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="text-sm font-medium text-indigo-600 truncate max-w-[70%]">
              {note.block_sequence_no !== undefined && (
                <span className="mr-2 text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
                  Block {note.block_sequence_no + 1}
                </span>
              )}
              {truncateContent(note.content.split('\n')[0] || 'Untitled Note', 60)}
            </div>
            <div className="text-xs text-neutral-500">
              {formatDate(note.created_at)}
            </div>
          </div>
          
          <div className="text-sm text-neutral-800 line-clamp-3">
            {truncateContent(note.content)}
          </div>
          
          <div className="mt-2 flex items-center text-xs">
            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
              Message {note.message_id?.substring(0, 8)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
