import { useRef, useSyncExternalStore } from 'react';
import type { Block } from '../components/pdf/PDFViewer';
import type { RabbitholeHighlight } from '../services/rabbithole';

type BlocksById = Record<string, Block>;

type State = {
  blocksById: BlocksById;
  blockOrder: string[];
  currentBlockId: string | null;
  rabbitholesByBlockId: Record<string, RabbitholeHighlight[]>;
};

let state: State = {
  blocksById: {},
  blockOrder: [],
  currentBlockId: null,
  rabbitholesByBlockId: {},
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
  setRabbitholes(blockId: string, highlights: RabbitholeHighlight[]) {
    const next = { ...state.rabbitholesByBlockId, [blockId]: highlights };
    setState({ rabbitholesByBlockId: next });
  },
  addRabbitholeHighlight(blockId: string, highlight: RabbitholeHighlight) {
    const current = state.rabbitholesByBlockId[blockId] || [];
    const keyOf = (h: RabbitholeHighlight) => `${(h as any).conversation_id || h.id || ''}:${h.text_start_offset}-${h.text_end_offset}`;
    const map = new Map<string, RabbitholeHighlight>();
    for (const h of current) map.set(keyOf(h), h);
    map.set(keyOf(highlight), highlight);
    const nextArr = Array.from(map.values());
    setState({ rabbitholesByBlockId: { ...state.rabbitholesByBlockId, [blockId]: nextArr } });
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

export function useBlockRabbitholes(blockId: string) {
  return useBlocksSelector((s) => s.rabbitholesByBlockId[blockId] || [], (a, b) => {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const ka = `${(a[i] as any).conversation_id || a[i].id || ''}:${a[i].text_start_offset}-${a[i].text_end_offset}`;
      const kb = `${(b[i] as any).conversation_id || b[i].id || ''}:${b[i].text_start_offset}-${b[i].text_end_offset}`;
      if (ka !== kb) return false;
    }
    return true;
  });
}

export function useCurrentBlockId() {
  return useBlocksSelector((s) => s.currentBlockId, (a, b) => a === b);
} 