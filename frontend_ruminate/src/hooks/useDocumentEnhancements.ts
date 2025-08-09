import { useCallback, useEffect } from 'react';
import { useTextEnhancements } from './useTextEnhancements';
import { blocksActions } from '../store/blocksStore';
import { groupEnhancementsByBlock } from '../store/enhancementUtils';
import { textEnhancementsApi, type TextEnhancement } from '../services/api/textEnhancements';

/**
 * Document-level enhancement manager
 * Owns ALL enhancement data and mutations for a document
 * Components should only read from store and call these mutation methods
 */
export function useDocumentEnhancements(documentId: string) {
  const { enhancements, loading, error, refetch } = useTextEnhancements(documentId);
  
  // Initialize store when enhancements are loaded
  useEffect(() => {
    if (enhancements) {
      const enhancementsByBlock = groupEnhancementsByBlock(enhancements);
      blocksActions.initializeEnhancements(enhancementsByBlock);
    }
  }, [enhancements]);

  // Optimistic enhancement creation with rollback
  const createDefinition = useCallback(async (
    blockId: string,
    term: string,
    textStartOffset: number,
    textEndOffset: number,
    surroundingText?: string
  ): Promise<TextEnhancement> => {
    // Create optimistic enhancement
    const optimisticEnhancement: TextEnhancement = {
      id: `temp-${Date.now()}`, // Temporary ID
      document_id: documentId,
      block_id: blockId,
      user_id: '', // Will be set by server
      text: term,
      text_start_offset: textStartOffset,
      text_end_offset: textEndOffset,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      type: 'DEFINITION',
      data: {
        term,
        definition: 'Loading...', // Placeholder
        context: surroundingText,
      },
    };

    // 1. Optimistically add to store
    blocksActions.addEnhancement(blockId, optimisticEnhancement);

    try {
      // 2. Create on server
      const serverEnhancement = await textEnhancementsApi.createDefinition(documentId, {
        block_id: blockId,
        term,
        text_start_offset: textStartOffset,
        text_end_offset: textEndOffset,
        surrounding_text: surroundingText,
      });

      // 3. Replace optimistic with server version
      blocksActions.removeEnhancement(blockId, optimisticEnhancement.id);
      blocksActions.addEnhancement(blockId, serverEnhancement);
      
      return serverEnhancement;
    } catch (error) {
      // 4. Rollback on failure
      blocksActions.removeEnhancement(blockId, optimisticEnhancement.id);
      throw error;
    }
  }, [documentId]);

  const createAnnotation = useCallback(async (
    blockId: string,
    text: string,
    note: string,
    textStartOffset: number,
    textEndOffset: number
  ): Promise<TextEnhancement | null> => {
    // Create optimistic enhancement
    const optimisticEnhancement: TextEnhancement = {
      id: `temp-${Date.now()}`,
      document_id: documentId,
      block_id: blockId,
      user_id: '',
      text,
      text_start_offset: textStartOffset,
      text_end_offset: textEndOffset,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      type: 'ANNOTATION',
      data: { note },
    };

    // 1. Optimistically add to store
    blocksActions.addEnhancement(blockId, optimisticEnhancement);

    try {
      // 2. Create on server
      const result = await textEnhancementsApi.createAnnotation(documentId, {
        block_id: blockId,
        text,
        note,
        text_start_offset: textStartOffset,
        text_end_offset: textEndOffset,
      });

      // 3. Handle server response
      blocksActions.removeEnhancement(blockId, optimisticEnhancement.id);
      
      // Server might return deletion message if note was empty
      if ('message' in result) {
        return null; // Annotation was deleted
      } else {
        blocksActions.addEnhancement(blockId, result);
        return result;
      }
    } catch (error) {
      // 4. Rollback on failure
      blocksActions.removeEnhancement(blockId, optimisticEnhancement.id);
      throw error;
    }
  }, [documentId]);

  const createRabbithole = useCallback(async (
    blockId: string,
    selectedText: string,
    textStartOffset: number,
    textEndOffset: number
  ): Promise<string> => {
    // Import createRabbithole from rabbithole service
    const { createRabbithole: createRabbitholeAPI } = await import('../services/rabbithole');
    
    try {
      // Create rabbithole conversation
      const conversationId = await createRabbitholeAPI({
        document_id: documentId,
        block_id: blockId,
        selected_text: selectedText,
        start_offset: textStartOffset,
        end_offset: textEndOffset,
        type: 'rabbithole',
      });

      // Create enhancement object
      const rabbitholeEnhancement: TextEnhancement = {
        id: conversationId,
        document_id: documentId,
        block_id: blockId,
        user_id: '', // Will be set by server
        text: selectedText,
        text_start_offset: textStartOffset,
        text_end_offset: textEndOffset,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        type: 'RABBITHOLE',
        data: { conversation_id: conversationId },
      };

      // Add to store
      blocksActions.addEnhancement(blockId, rabbitholeEnhancement);
      
      return conversationId;
    } catch (error) {
      console.error('[DocumentEnhancements] Failed to create rabbithole:', error);
      throw error;
    }
  }, [documentId]);

  const deleteEnhancement = useCallback(async (
    blockId: string,
    enhancementId: string
  ): Promise<void> => {
    // Get current enhancement for rollback
    const currentEnhancements = blocksActions.getEnhancementsByBlockId(blockId);
    const enhancement = currentEnhancements?.find((e: TextEnhancement) => e.id === enhancementId);
    
    if (!enhancement) return;

    // 1. Optimistically remove from store
    blocksActions.removeEnhancement(blockId, enhancementId);

    try {
      // 2. Delete on server
      await textEnhancementsApi.deleteEnhancement(documentId, enhancementId);
    } catch (error) {
      // 3. Rollback on failure
      blocksActions.addEnhancement(blockId, enhancement);
      throw error;
    }
  }, [documentId]);

  return {
    loading,
    error,
    refetch,
    // Mutation methods - components should call these instead of API directly
    createDefinition,
    createAnnotation,
    createRabbithole,
    deleteEnhancement,
  };
}