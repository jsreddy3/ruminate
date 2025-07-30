import React from 'react';

/**
 * Debug component to understand the off-by-one error
 * Add this temporarily to see what's happening with text selection
 */
export const debugTextSelection = (
  root: HTMLElement,
  startOffset: number,
  endOffset: number,
  description: string = ''
) => {
  console.log(`\n=== DEBUG: ${description} ===`);
  console.log(`Target range: ${startOffset}-${endOffset}`);
  
  // Get full text
  const fullText = root.textContent || '';
  console.log(`Full text: "${fullText}"`);
  console.log(`Target text should be: "${fullText.substring(startOffset, endOffset)}"`);
  
  // Walk through text nodes
  const textNodes: Node[] = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  console.log(`Found ${textNodes.length} text nodes`);
  
  let currentOffset = 0;
  let startNode: Node | null = null;
  let startNodeOffset = 0;
  let endNode: Node | null = null;
  let endNodeOffset = 0;
  
  for (let i = 0; i < textNodes.length; i++) {
    const textNode = textNodes[i];
    const nodeLength = textNode.textContent?.length || 0;
    const nodeText = textNode.textContent || '';
    
    console.log(`Node ${i}: "${nodeText}" (offset ${currentOffset}-${currentOffset + nodeLength - 1}, length ${nodeLength})`);
    
    // Check start node logic
    if (startNode === null && currentOffset + nodeLength > startOffset) {
      startNode = textNode;
      startNodeOffset = startOffset - currentOffset;
      console.log(`  ✓ START NODE FOUND: offset ${startNodeOffset} in node "${nodeText}"`);
      console.log(`    Character at start: "${nodeText.charAt(startNodeOffset)}"`);
    }
    
    // Check end node logic  
    if (endNode === null && currentOffset + nodeLength >= endOffset) {
      endNode = textNode;
      endNodeOffset = endOffset - currentOffset;
      console.log(`  ✓ END NODE FOUND: offset ${endNodeOffset} in node "${nodeText}"`);
      break;
    }
    
    currentOffset += nodeLength;
  }
  
  // Test the actual range creation
  if (startNode && endNode) {
    try {
      const range = document.createRange();
      range.setStart(startNode, startNodeOffset);
      range.setEnd(endNode, endNodeOffset);
      
      const rangeText = range.toString();
      console.log(`Final range text: "${rangeText}"`);
      console.log(`Expected text: "${fullText.substring(startOffset, endOffset)}"`);
      console.log(`Match: ${rangeText === fullText.substring(startOffset, endOffset) ? '✓' : '✗'}`);
      
      if (rangeText !== fullText.substring(startOffset, endOffset)) {
        console.error('MISMATCH! This is the bug.');
      }
      
    } catch (err) {
      console.error('Error creating range:', err);
    }
  } else {
    console.error('Could not find start or end node');
  }
  
  console.log('=== END DEBUG ===\n');
};

// React component for debugging in the UI
interface DebugHighlightProps {
  contentRef: React.RefObject<HTMLElement>;
  testOffset?: number;
  testLength?: number;
}

const DebugHighlight: React.FC<DebugHighlightProps> = ({ 
  contentRef, 
  testOffset = 0, 
  testLength = 8 
}) => {
  React.useEffect(() => {
    if (contentRef.current) {
      debugTextSelection(
        contentRef.current,
        testOffset,
        testOffset + testLength,
        `Test highlight at ${testOffset}-${testOffset + testLength}`
      );
    }
  }, [contentRef, testOffset, testLength]);

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: 'yellow', 
      padding: '10px',
      fontSize: '12px',
      zIndex: 9999,
      border: '1px solid black'
    }}>
      DEBUG: Check console for text selection analysis
      <br />
      Testing offset {testOffset}-{testOffset + testLength}
    </div>
  );
};

export default DebugHighlight;