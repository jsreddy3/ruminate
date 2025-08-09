import { useRef, useSyncExternalStore } from 'react';
import type { Block } from '../components/pdf/PDFViewer';
import type { TextEnhancement } from '../services/api/textEnhancements';

type BlocksById = Record<string, Block>;

type State = {
  blocksById: BlocksById;
  blockOrder: string[];
  currentBlockId: string | null;
  enhancementsByBlockId: Record<string, TextEnhancement[]>;
};

let state: State = {
  blocksById: {},
  blockOrder: [],
  currentBlockId: null,
  enhancementsByBlockId: {},
};

const listeners = new Set<() => void>();

function getSnapshot() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(partial: Partial<State>) {
  state = { ...state, ...partial };
  listeners.forEach((l) => l());
}

// Actions
export const blocksActions = {
  // Getter method for internal use (avoids triggering subscriptions)
  getEnhancementsByBlockId(blockId: string): TextEnhancement[] {
    return state.enhancementsByBlockId[blockId] || [];
  },
  getBlockOrder(): string[] {
    return state.blockOrder;
  },
  getCurrentBlockId(): string | null {
    return state.currentBlockId;
  },
  initialize(blocks: Block[], currentBlockId: string | null) {
    const blocksById: BlocksById = {};
    const order: string[] = [];
    for (const b of blocks) {
      blocksById[b.id] = b;
      order.push(b.id);
    }
    setState({ blocksById, blockOrder: order, currentBlockId });
  },
  setCurrentBlockId(blockId: string) {
    if (state.currentBlockId === blockId) return;
    
    const isProblematicBlock = blockId === '5f50d3a1-8d40-4c9c-abef-11589f961fed';
    const isFirstBlock = state.blockOrder[0] === blockId;
    
    console.log('[BlocksStore] setCurrentBlockId called:', {
      newBlockId: blockId,
      previousBlockId: state.currentBlockId,
      isProblematicBlock,
      isFirstBlock,
      blockExists: !!state.blocksById[blockId],
      blockIndex: state.blockOrder.findIndex(id => id === blockId),
      timestamp: new Date().toISOString(),
      callStack: isProblematicBlock ? new Error().stack : 'not logged'
    });
    
    setState({ currentBlockId: blockId });
  },
  mergeBlockMetadata(blockId: string, newMetadata: any) {
    const existing = state.blocksById[blockId];
    if (!existing) return;
    const merged = {
      ...existing,
      metadata: {
        ...(existing.metadata || {}),
        ...(newMetadata || {}),
      },
    } as Block;
    setState({
      blocksById: { ...state.blocksById, [blockId]: merged },
    });
  },
  setBlockImages(blockId: string, images: { [key: string]: string }) {
    const existing = state.blocksById[blockId];
    if (!existing) return;
    const updated = { ...existing, images } as Block;
    setState({ blocksById: { ...state.blocksById, [blockId]: updated } });
  },
  setEnhancements(blockId: string, enhancements: TextEnhancement[]) {
    // Only update if enhancements actually changed
    const current = state.enhancementsByBlockId[blockId];
    if (current && arraysEqual(current, enhancements)) return;
    
    const next = { ...state.enhancementsByBlockId, [blockId]: enhancements };
    setState({ enhancementsByBlockId: next });
  },
  addEnhancement(blockId: string, enhancement: TextEnhancement) {
    const current = state.enhancementsByBlockId[blockId] || [];
    
    // Check if enhancement already exists to avoid duplicate updates
    const existingIndex = current.findIndex(e => e.id === enhancement.id);
    if (existingIndex >= 0) {
      // Replace existing enhancement
      if (enhancementsEqual(current[existingIndex], enhancement)) return; // No change
      const nextArr = [...current];
      nextArr[existingIndex] = enhancement;
      setState({ enhancementsByBlockId: { ...state.enhancementsByBlockId, [blockId]: nextArr } });
    } else {
      // Add new enhancement, keeping array sorted by text position
      const nextArr = [...current, enhancement].sort((a, b) => a.text_start_offset - b.text_start_offset);
      setState({ enhancementsByBlockId: { ...state.enhancementsByBlockId, [blockId]: nextArr } });
    }
  },
  removeEnhancement(blockId: string, enhancementId: string) {
    const current = state.enhancementsByBlockId[blockId] || [];
    const index = current.findIndex(e => e.id === enhancementId);
    if (index === -1) return; // Enhancement not found, no update needed
    
    const filtered = current.filter((_, i) => i !== index);
    setState({ enhancementsByBlockId: { ...state.enhancementsByBlockId, [blockId]: filtered } });
  },
  initializeEnhancements(enhancementsByBlock: Record<string, TextEnhancement[]>) {
    setState({ enhancementsByBlockId: enhancementsByBlock });
  },
};

// Selectors hook with referential stability
export function useBlocksSelector<T>(selector: (s: State) => T, equality?: (a: T, b: T) => boolean) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const selected = selector(snap);
  const ref = useRef<T>(selected);
  const isEqual = equality ? equality(ref.current, selected) : ref.current === selected;
  if (!isEqual) {
    ref.current = selected;
  }
  return ref.current;
}

// Convenience selectors
export function useBlock(blockId: string) {
  return useBlocksSelector((s) => s.blocksById[blockId], (a, b) => a === b);
}

// Get all enhancements for a block, optionally filtered by type
export function useBlockEnhancements(blockId: string, type?: 'DEFINITION' | 'ANNOTATION' | 'RABBITHOLE') {
  return useBlocksSelector((s) => {
    const enhancements = s.enhancementsByBlockId[blockId] || [];
    return type ? enhancements.filter(e => e.type === type) : enhancements;
  }, (a, b) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i].id !== b[i].id || a[i].text_start_offset !== b[i].text_start_offset || a[i].text_end_offset !== b[i].text_end_offset) return false;
    }
    return true;
  });
}

// Backwards compatibility - get only rabbithole enhancements
export function useBlockRabbitholes(blockId: string) {
  return useBlockEnhancements(blockId, 'RABBITHOLE');
}

// Convenience selectors for specific enhancement types
export function useBlockDefinitions(blockId: string) {
  return useBlockEnhancements(blockId, 'DEFINITION');
}

export function useBlockAnnotations(blockId: string) {
  return useBlockEnhancements(blockId, 'ANNOTATION');
}

export function useCurrentBlockId() {
  return useBlocksSelector((s) => s.currentBlockId, (a, b) => a === b);
}

// Helper functions for performance optimization
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false; // Reference equality for objects
  }
  return true;
}

function enhancementsEqual(a: TextEnhancement, b: TextEnhancement): boolean {
  return (
    a.id === b.id &&
    a.text_start_offset === b.text_start_offset &&
    a.text_end_offset === b.text_end_offset &&
    a.text === b.text &&
    a.type === b.type &&
    JSON.stringify(a.data) === JSON.stringify(b.data) // Deep compare data
  );
} 