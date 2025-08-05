import { Block } from '../components/pdf/PDFViewer';

// Chat-enabled block types that should be navigable
const CHAT_ENABLED_BLOCK_TYPES = [
  "text",
  "sectionheader",
  "pageheader",
  "pagefooter",
  "listitem",
  "footnote",
  "reference",
  "picture",
  "figure",
  "image",
  "textinlinemath",
  "equation",
  "table"
].map(type => type.toLowerCase());

// Block types that don't need minimum word count
const NO_MIN_WORD_COUNT_TYPES = [
  "picture",
  "figure",
  "image",
  "equation",
  "table"
].map(type => type.toLowerCase());

/**
 * Determines if a block should be navigable/clickable based on content and type
 */
export function isBlockNavigable(block: Block): boolean {
  // Block must have a valid type
  if (!block.block_type) return false;
  
  const blockType = block.block_type.toLowerCase();
  
  // Not be a page block
  if (blockType === "page") return false;
  
  // Must be in our list of chat-enabled types
  if (!CHAT_ENABLED_BLOCK_TYPES.includes(blockType)) return false;
  
  // Must have content (HTML or images)
  const hasImages = block.images && Object.keys(block.images).length > 0;
  const hasHtmlContent = !!block.html_content;
  
  if (!hasHtmlContent && !hasImages) {
    // Special case for image-type blocks that might not have loaded images yet
    if (NO_MIN_WORD_COUNT_TYPES.includes(blockType)) {
      return true;
    }
    return false;
  }
  
  // If HTML content exists, check word count for text-based blocks
  if (hasHtmlContent && !NO_MIN_WORD_COUNT_TYPES.includes(blockType)) {
    // Strip HTML tags and count words
    const textContent = block.html_content.replace(/<[^>]*>/g, '').trim();
    const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
    
    // Require at least 4 words for text-based blocks
    if (wordCount < 4) {
      return false;
    }
  }
  
  return true;
}

/**
 * Filters blocks to only include navigable ones
 */
export function filterNavigableBlocks(blocks: Block[]): Block[] {
  return blocks.filter(isBlockNavigable);
}