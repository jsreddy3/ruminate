import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTextInteraction } from './TextInteractionContext';
import TextSelectionTooltip from './TooltipManager/TextSelectionTooltip';
import DefinitionPopup from './TooltipManager/DefinitionPopup';
import AnnotationEditor from './TooltipManager/AnnotationEditor';
import { documentApi } from '@/services/api/document';

interface GlobalTextOverlayProps {
  onAddToChat?: (docId: string, blockId: string, text: string) => void;
  onCreateRabbithole?: (docId: string, blockId: string, text: string, start: number, end: number) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
}

export default function GlobalTextOverlay({ onAddToChat, onCreateRabbithole, onUpdateBlockMetadata }: GlobalTextOverlayProps) {
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
            const result = await documentApi.getTermDefinition(
              t.documentId,
              t.blockId,
              text,
              t.startOffset,
              t.endOffset
            );
            if (result?.definition && onUpdateBlockMetadata) {
              const key = `${t.startOffset}-${t.endOffset}`;
              onUpdateBlockMetadata(t.blockId, {
                definitions: {
                  [key]: {
                    term: text,
                    definition: result.definition,
                    text_start_offset: t.startOffset,
                    text_end_offset: t.endOffset,
                    created_at: new Date().toISOString(),
                  }
                }
              });
            }
            // Reopen with saved definition (update context state)
            openDefinition({
              position: t.position,
              documentId: t.documentId,
              blockId: t.blockId,
              term: text,
              startOffset: t.startOffset,
              endOffset: t.endOffset,
              savedDefinition: result?.definition,
              disableFetch: true,
            });
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
          if (onUpdateBlockMetadata) {
            const key = `${start}-${end}`;
            onUpdateBlockMetadata(d.blockId, {
              definitions: {
                [key]: {
                  term,
                  definition,
                  text_start_offset: start,
                  text_end_offset: end,
                  created_at: new Date().toISOString(),
                }
              }
            });
          }
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
            const result = await documentApi.createAnnotation(
              a.documentId,
              a.blockId,
              a.selectedText,
              note,
              a.startOffset,
              a.endOffset
            );
            if (result && onUpdateBlockMetadata && (result as any).id) {
              const r = result as {
                id: string;
                text: string;
                note: string;
                text_start_offset: number;
                text_end_offset: number;
                created_at: string;
                updated_at: string;
              };
              const key = `${a.startOffset}-${a.endOffset}`;
              onUpdateBlockMetadata(a.blockId, {
                annotations: {
                  [key]: {
                    id: r.id,
                    text: r.text,
                    note: r.note,
                    text_start_offset: r.text_start_offset,
                    text_end_offset: r.text_end_offset,
                    created_at: r.created_at,
                    updated_at: r.updated_at,
                  }
                }
              });
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