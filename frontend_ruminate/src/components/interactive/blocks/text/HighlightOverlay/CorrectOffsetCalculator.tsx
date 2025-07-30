/**
 * Correct offset calculation utilities
 * Based on the working TextRenderer implementation
 */

// Helper function to correctly find text position from character offset
// Uses the EXACT same method as TextRenderer: toString().length on ranges
export const findTextPositionFromOffset = (
  root: HTMLElement, 
  startOffset: number, 
  endOffset: number
): DOMRect[] | null => {
  try {
    // Validate offsets
    const textContent = root.textContent || '';
    if (startOffset < 0 || endOffset > textContent.length || startOffset >= endOffset) {
      return null;
    }

    // Create a walker to traverse all text nodes
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes: Text[] = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    if (textNodes.length === 0) return null;

    // Use the EXACT same method as TextRenderer:
    // Create ranges and use toString().length to find positions
    let bestStartNode: Text | null = null;
    let bestStartOffset = 0;
    let bestEndNode: Text | null = null;
    let bestEndOffset = 0;

    // Try each possible start position to find the one that gives us the right toString() length
    for (let nodeIndex = 0; nodeIndex < textNodes.length; nodeIndex++) {
      const startNode = textNodes[nodeIndex];
      
      for (let charIndex = 0; charIndex <= (startNode.textContent?.length || 0); charIndex++) {
        try {
          // Create a range from content start to this position
          const testRange = document.createRange();        
          testRange.selectNodeContents(root);
          testRange.setEnd(startNode, charIndex);
          
          const currentLength = testRange.toString().length;
          
          // If this matches our target start offset
          if (currentLength === startOffset) {
            bestStartNode = startNode;
            bestStartOffset = charIndex;
            
            // Now find the end position
            for (let endNodeIndex = nodeIndex; endNodeIndex < textNodes.length; endNodeIndex++) {
              const endNode = textNodes[endNodeIndex];
              
              for (let endCharIndex = (endNodeIndex === nodeIndex ? charIndex : 0); 
                   endCharIndex <= (endNode.textContent?.length || 0); endCharIndex++) {
                try {
                  const endTestRange = document.createRange();
                  endTestRange.selectNodeContents(root);
                  endTestRange.setEnd(endNode, endCharIndex);
                  
                  const endLength = endTestRange.toString().length;
                  
                  if (endLength === endOffset) {
                    bestEndNode = endNode;
                    bestEndOffset = endCharIndex;
                    break;
                  }
                } catch (e) {
                  // Continue trying
                }
              }
              
              if (bestEndNode) break;
            }
            
            break;
          }
        } catch (e) {
          // Continue trying
        }
      }
      
      if (bestStartNode && bestEndNode) break;
    }

    // Create the final range
    if (bestStartNode && bestEndNode) {
      const range = document.createRange();
      range.setStart(bestStartNode, bestStartOffset);
      range.setEnd(bestEndNode, bestEndOffset);
      
      return Array.from(range.getClientRects());
    }

    return null;
  } catch (err) {
    console.error('Error finding text position from offset:', err);
    return null;
  }
};

// Alternative approach using the browser's native selection API
export const findTextPositionFromOffsetNative = (
  root: HTMLElement,
  startOffset: number,
  endOffset: number
): DOMRect[] | null => {
  try {
    // Get the full text content
    const fullText = root.textContent || '';
    
    // Validate offsets
    if (startOffset < 0 || endOffset > fullText.length || startOffset >= endOffset) {
      return null;
    }

    // Create a temporary range that covers the entire content
    const tempRange = document.createRange();
    tempRange.selectNodeContents(root);
    
    // Create the selection range we want
    const selection = window.getSelection();
    if (!selection) return null;
    
    // Clear existing selection
    selection.removeAllRanges();
    
    // Add our temporary range to find the positions
    selection.addRange(tempRange);
    
    // Now collapse to start and extend to find our actual positions
    selection.collapseToStart();
    selection.modify('move', 'forward', 'character');
    
    // This is more complex - let's stick with the first approach but fix it
    return null;
  } catch (err) {
    console.error('Error with native selection approach:', err);
    return null;
  }
};