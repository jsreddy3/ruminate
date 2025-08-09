import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTextInteraction } from './TextInteractionContext';
import TextSelectionTooltip from './TooltipManager/TextSelectionTooltip';
import DefinitionPopup from './TooltipManager/DefinitionPopup';
import AnnotationEditor from './TooltipManager/AnnotationEditor';

interface GlobalTextOverlayProps {
  onAddToChat?: (docId: string, blockId: string, text: string) => void;
  onCreateRabbithole?: (docId: string, blockId: string, text: string, start: number, end: number) => void;
  onCreateDefinition?: (blockId: string, term: string, startOffset: number, endOffset: number, context?: string) => Promise<any>;
  onCreateAnnotation?: (blockId: string, text: string, note: string, startOffset: number, endOffset: number) => Promise<any>;
}

export default function GlobalTextOverlay({ onAddToChat, onCreateRabbithole, onCreateDefinition, onCreateAnnotation }: GlobalTextOverlayProps) {
  const { state, close, openDefinition, openAnnotation } = useTextInteraction();
  const [saving, setSaving] = useState(false);

  if (state.mode === 'tooltip' && state.tooltip) {
    const t = state.tooltip;
    return createPortal(
      <TextSelectionTooltip
        isVisible={true}
        position={t.position}
        selectedText={t.selectedText}
        onAddToChat={(text) => onAddToChat?.(t.documentId, t.blockId, text)}
        onDefine={async (text) => {
          try {
            // Open immediately with loading spinner
            openDefinition({
              position: t.position,
              documentId: t.documentId,
              blockId: t.blockId,
              term: text,
              startOffset: t.startOffset,
              endOffset: t.endOffset,
              loading: true,
              disableFetch: true,
            });
            
            // Use new unified system
            if (onCreateDefinition) {
              const result = await onCreateDefinition(
                t.blockId,
                text,
                t.startOffset,
                t.endOffset,
                window.getSelection?.()?.toString() || ''
              );

              // Reopen with saved definition
              openDefinition({
                position: t.position,
                documentId: t.documentId,
                blockId: t.blockId,
                term: text,
                startOffset: t.startOffset,
                endOffset: t.endOffset,
                savedDefinition: result.data.definition,
                disableFetch: true,
              });
            }
          } catch (e) {
            // Fallback: open without savedDefinition; popup can fetch if allowed
            openDefinition({
              position: t.position,
              documentId: t.documentId,
              blockId: t.blockId,
              term: text,
              startOffset: t.startOffset,
              endOffset: t.endOffset,
            });
          }
        }}
        onAnnotate={(text) => openAnnotation({
          position: t.position,
          documentId: t.documentId,
          blockId: t.blockId,
          selectedText: text,
          startOffset: t.startOffset,
          endOffset: t.endOffset,
        })}
        onCreateRabbithole={(text) => onCreateRabbithole?.(t.documentId, t.blockId, text, t.startOffset, t.endOffset)}
        onClose={close}
        documentId={t.documentId}
        blockId={t.blockId}
        isDefining={false}
        isOnboardingStep5={false}
        isOnboardingStep6={false}
      />,
      document.body
    );
  }

  if (state.mode === 'definition' && state.definition) {
    const d = state.definition;
    return createPortal(
      <DefinitionPopup
        isVisible={true}
        position={d.position}
        term={d.term}
        textStartOffset={d.startOffset}
        textEndOffset={d.endOffset}
        documentId={d.documentId}
        blockId={d.blockId}
        savedDefinition={d.savedDefinition}
        onClose={close}
        onDefinitionSaved={(term, definition, start, end) => {
          // Definition saving is now handled by onDefine above
          // No need for additional metadata updates
        }}
        loading={d.loading}
        disableFetch={d.disableFetch}
      />,
      document.body
    );
  }

  if (state.mode === 'annotation' && state.annotation) {
    const a = state.annotation;
    return createPortal(
      <AnnotationEditor
        isVisible={true}
        position={a.position}
        selectedText={a.selectedText}
        textStartOffset={a.startOffset}
        textEndOffset={a.endOffset}
        documentId={a.documentId}
        blockId={a.blockId}
        onClose={close}
        onSave={async (note: string) => {
          setSaving(true);
          try {
            // Use new unified system
            if (onCreateAnnotation) {
              await onCreateAnnotation(
                a.blockId,
                a.selectedText,
                note,
                a.startOffset,
                a.endOffset
              );
            }
          } finally {
            setSaving(false);
          }
        }}
      />,
      document.body
    );
  }

  return null;
} 