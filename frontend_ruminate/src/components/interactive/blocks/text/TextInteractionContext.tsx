import React, { createContext, useContext, useState, useCallback } from 'react';

type InteractionMode = 'tooltip' | 'definition' | 'annotation';

interface BasePositioned {
  position: { x: number; y: number };
  documentId: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
}

interface TooltipPayload extends BasePositioned {
  selectedText: string;
}

interface DefinitionPayload extends BasePositioned {
  term: string;
  savedDefinition?: string;
  loading?: boolean;
  disableFetch?: boolean;
}

interface AnnotationPayload extends BasePositioned {
  selectedText: string;
  existingAnnotation?: {
    id: string;
    note: string;
    created_at: string;
    updated_at: string;
  };
}

interface InteractionState {
  mode: InteractionMode | null;
  tooltip?: TooltipPayload;
  definition?: DefinitionPayload;
  annotation?: AnnotationPayload;
}

interface TextInteractionContextValue {
  state: InteractionState;
  openTooltip: (p: TooltipPayload) => void;
  openDefinition: (p: DefinitionPayload) => void;
  openAnnotation: (p: AnnotationPayload) => void;
  close: () => void;
}

const TextInteractionContext = createContext<TextInteractionContextValue | null>(null);

export function TextInteractionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<InteractionState>({ mode: null });

  const openTooltip = useCallback((p: TooltipPayload) => {
    setState({ mode: 'tooltip', tooltip: p });
  }, []);

  const openDefinition = useCallback((p: DefinitionPayload) => {
    setState({ mode: 'definition', definition: p });
  }, []);

  const openAnnotation = useCallback((p: AnnotationPayload) => {
    setState({ mode: 'annotation', annotation: p });
  }, []);

  const close = useCallback(() => setState({ mode: null }), []);

  const value: TextInteractionContextValue = {
    state,
    openTooltip,
    openDefinition,
    openAnnotation,
    close,
  };

  return (
    <TextInteractionContext.Provider value={value}>
      {children}
    </TextInteractionContext.Provider>
  );
}

export function useTextInteraction() {
  const ctx = useContext(TextInteractionContext);
  if (!ctx) throw new Error('useTextInteraction must be used within TextInteractionProvider');
  return ctx;
} 