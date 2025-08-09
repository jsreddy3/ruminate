import type { TextEnhancement, TextEnhancementsResponse } from '../services/api/textEnhancements';

/**
 * Groups text enhancements by block ID for efficient storage in the blocks store
 */
export function groupEnhancementsByBlock(enhancements: TextEnhancementsResponse): Record<string, TextEnhancement[]> {
  const enhancementsByBlock: Record<string, TextEnhancement[]> = {};
  
  // Combine all enhancement types into a single array
  const allEnhancements: TextEnhancement[] = [
    ...enhancements.definitions,
    ...enhancements.annotations,
    ...enhancements.rabbitholes,
  ];
  
  // Group by block_id
  for (const enhancement of allEnhancements) {
    const blockId = enhancement.block_id;
    if (!enhancementsByBlock[blockId]) {
      enhancementsByBlock[blockId] = [];
    }
    enhancementsByBlock[blockId].push(enhancement);
  }
  
  // Sort enhancements within each block by text position
  for (const blockId in enhancementsByBlock) {
    enhancementsByBlock[blockId].sort((a, b) => a.text_start_offset - b.text_start_offset);
  }
  
  return enhancementsByBlock;
}

/**
 * Converts old rabbithole highlight format to new text enhancement format
 * Useful for migration/backwards compatibility
 */
export function convertRabbitholeToEnhancement(
  rabbithole: any,
  blockId: string,
  documentId: string
): TextEnhancement {
  return {
    id: rabbithole.id || rabbithole.conversation_id,
    document_id: documentId,
    block_id: blockId,
    user_id: '', // Will need to be filled in by the calling code
    text: rabbithole.selected_text,
    text_start_offset: rabbithole.text_start_offset,
    text_end_offset: rabbithole.text_end_offset,
    created_at: rabbithole.created_at,
    updated_at: rabbithole.created_at,
    type: 'RABBITHOLE' as const,
    data: {
      conversation_id: rabbithole.conversation_id || rabbithole.id,
    },
  };
}