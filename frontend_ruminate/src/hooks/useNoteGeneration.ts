import { useState, useCallback } from 'react';

interface UseNoteGenerationProps {
  conversationId: string | null;
  conversationType?: 'main' | 'rabbithole';
  rabbitholeMetadata?: {
    source_block_id: string;
    selected_text: string;
  };
  onRequestBlockSelection?: (config: {
    prompt: string;
    onComplete: (blockId: string) => void;
  }) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  onBlockMetadataUpdate?: () => void;
  onOpenBlockWithNote?: (blockId: string, noteId: string) => void;
  getBlockMetadata?: (blockId: string) => any;
}

export const useNoteGeneration = ({
  conversationId,
  conversationType = 'main',
  rabbitholeMetadata,
  onRequestBlockSelection,
  onUpdateBlockMetadata,
  onBlockMetadataUpdate,
  onOpenBlockWithNote,
  getBlockMetadata
}: UseNoteGenerationProps) => {
  const [showNotePopup, setShowNotePopup] = useState(false);
  const [isGeneratingNote, setIsGeneratingNote] = useState(false);
  const [noteGenerationStatus, setNoteGenerationStatus] = useState<string>('');

  const generateNoteForBlock = useCallback(async (blockId: string, messageCount: number, topic: string) => {
    try {          
      // Set loading state
      setIsGeneratingNote(true);
      setNoteGenerationStatus('Generating note...');
      
      // Call the backend API to generate note using existing API setup
      const { authenticatedFetch, API_BASE_URL } = await import('../utils/api');
      const response = await authenticatedFetch(
        `${API_BASE_URL}/conversations/${conversationId}/generate-note`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            block_id: blockId,
            message_count: messageCount,
            topic: topic || undefined
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate note');
      }

      const result = await response.json();
      
      setNoteGenerationStatus('Note created successfully!');
      
      // Update block metadata optimistically with generated note
      if (result.note_id && result.block_id && result.note && onUpdateBlockMetadata) {
        // Get current block metadata to preserve existing annotations
        const currentMetadata = getBlockMetadata ? getBlockMetadata(result.block_id) : null;
        
        // Use unique key based on note ID to prevent overwrites
        const annotationKey = `generated-${result.note_id}`;
        const newMetadata = {
          annotations: {
            // Actually preserve existing annotations
            ...currentMetadata?.annotations,
            [annotationKey]: {
              id: result.note_id,
              text: '', // Generated notes have empty text
              note: result.note,
              text_start_offset: -1, // Special value for generated notes
              text_end_offset: -1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              is_generated: true, // Special flag for generated notes
              conversation_id: result.conversation_id,
              source_conversation_id: result.conversation_id,
              message_count: messageCount,
              topic: topic || undefined
            }
          }
        };
        onUpdateBlockMetadata(result.block_id, newMetadata);            
        
        // Auto-open the block with the new note after a short delay
        setTimeout(() => {
          if (onOpenBlockWithNote && result.note_id && result.block_id) {
            onOpenBlockWithNote(result.block_id, result.note_id);
          }
          setIsGeneratingNote(false);
          setNoteGenerationStatus('');
        }, 1500);
      } else {
        // Fallback to old behavior if API doesn't return complete data or callback unavailable
        if (onBlockMetadataUpdate) {
          onBlockMetadataUpdate();
        }
        setIsGeneratingNote(false);
        setNoteGenerationStatus('');
      }          
    } catch (error) {
      console.error('Error generating note:', error);
      setNoteGenerationStatus('Failed to generate note');
      setTimeout(() => {
        setIsGeneratingNote(false);
        setNoteGenerationStatus('');
      }, 2000);
    }
  }, [conversationId, onUpdateBlockMetadata, getBlockMetadata, onOpenBlockWithNote, onBlockMetadataUpdate]);

  const handleGenerateNote = useCallback(async (messageCount: number, topic: string) => {
    if (!conversationId) {
      console.error('Cannot generate note: missing conversation ID');
      return;
    }

    // Close popup immediately
    setShowNotePopup(false);

    // For rabbithole conversations, auto-attach to source block
    if (conversationType === 'rabbithole' && rabbitholeMetadata?.source_block_id) {
      await generateNoteForBlock(rabbitholeMetadata.source_block_id, messageCount, topic);
      return;
    }

    // For main conversations, use block selection
    if (!onRequestBlockSelection) {
      console.error('Cannot generate note: missing block selection handler');
      return;
    }

    onRequestBlockSelection({
      prompt: "Select a block to save your conversation note",
      onComplete: async (blockId: string) => {
        await generateNoteForBlock(blockId, messageCount, topic);
      }
    });
  }, [conversationId, conversationType, rabbitholeMetadata, onRequestBlockSelection, generateNoteForBlock]);

  return {
    showNotePopup,
    setShowNotePopup,
    isGeneratingNote,
    noteGenerationStatus,
    handleGenerateNote
  };
};