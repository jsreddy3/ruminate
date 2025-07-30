import React, { useState, useEffect, useRef, useCallback } from 'react';
import TextContent from './TextContentFile';
import TextSelectionTooltip from './TooltipManager/TextSelectionTooltip';
import DefinitionPopup from './TooltipManager/DefinitionPopup';
import AnnotationEditor from './TooltipManager/AnnotationEditor';
import { RabbitholeHighlight } from '../../../../services/rabbithole';
import SelectionManager from './SelectionManager';
import ReactRabbitholeHighlight from './HighlightOverlay/RabbitholeHighlight';
import ReactDefinitionHighlight from './HighlightOverlay/DefinitionHighlight';
import ReactAnnotationHighlight from './HighlightOverlay/AnnotationHighlight';
import { documentApi } from '@/services/api/document';
import { createPortal } from 'react-dom';

interface TextRendererProps {
  htmlContent: string;
  blockType: string;
  blockId: string;
  documentId: string;
  metadata?: {
    definitions?: {
      [key: string]: {
        term: string;
        definition: string;
        text_start_offset: number;
        text_end_offset: number;
        created_at: string;
      };
    };
    annotations?: {
      [key: string]: {
        id: string;
        text: string;
        note: string;
        text_start_offset: number;
        text_end_offset: number;
        created_at: string;
        updated_at: string;
      };
    };
    [key: string]: any;
  };
  onAddTextToChat?: (text: string) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onRabbitholeClick?: (
    id: string, 
    text: string, 
    startOffset: number, 
    endOffset: number
  ) => void;
  rabbitholeHighlights?: RabbitholeHighlight[];
  getBlockClassName?: (blockType?: string) => string;
  highlights?: Array<{
    phrase: string;
    insight: string;
  }>;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  customStyle?: React.CSSProperties;
}

const TextRenderer: React.FC<TextRendererProps> = ({
  htmlContent,
  blockType,
  blockId,
  documentId,
  metadata: initialMetadata,
  onAddTextToChat,
  onCreateRabbithole,
  onRabbitholeClick,
  rabbitholeHighlights = [],
  getBlockClassName,
  highlights = [],
  onUpdateBlockMetadata,
  customStyle
}) => {
  // Use metadata directly from props - no local state needed
  const metadata = initialMetadata;
  
  const blockRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // State for tooltip handling
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  
  // State for selected text range
  const [selectedRange, setSelectedRange] = useState<{
    text: string,
    startOffset: number,
    endOffset: number
  } | null>(null);
  
  // State for definition popup
  const [definitionVisible, setDefinitionVisible] = useState(false);
  const [definitionWord, setDefinitionWord] = useState('');
  const [definitionPosition, setDefinitionPosition] = useState({ x: 0, y: 0 });
  const [savedDefinition, setSavedDefinition] = useState<string | null>(null);
  const [definitionOffsets, setDefinitionOffsets] = useState<{startOffset: number, endOffset: number} | null>(null);
  
  // State for annotation editor
  const [annotationVisible, setAnnotationVisible] = useState(false);
  const [annotationPosition, setAnnotationPosition] = useState({ x: 0, y: 0 });
  const [editingAnnotation, setEditingAnnotation] = useState<{
    id: string;
    note: string;
    created_at: string;
    updated_at: string;
  } | null>(null);
  
  
  // Handle text selection
  const handleTextSelected = (
    text: string, 
    position: { x: number, y: number }, 
    rects: DOMRect[]
  ) => {
    setSelectedText(text);
    setTooltipPosition(position);
    setTooltipVisible(true);
    
    // Calculate text offsets for the selected text
    if (contentRef.current) {
      const selection = window.getSelection();
      
      // If we have a selection, try to get the range and offsets
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // Find container nodes to calculate offsets
        const preSelectionRange = range.cloneRange();
        preSelectionRange.selectNodeContents(contentRef.current);
        preSelectionRange.setEnd(range.startContainer, range.startOffset);
        const startOffset = preSelectionRange.toString().length;
        
        // Calculate end offset
        const endOffset = startOffset + text.length;
        
        // Save selection range data
        setSelectedRange({
          text,
          startOffset,
          endOffset
        });
      }
    }
  };
  
  // Clear selection
  const clearSelection = () => {
    // Don't clear selection if annotation editor is open
    if (annotationVisible) {
      return;
    }
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  };
  
  // Handle adding text to chat
  const handleAddToChat = (text: string) => {
    if (onAddTextToChat) {
      onAddTextToChat(text);
    }
    
    // Only hide tooltip, don't clear selection yet
    setTooltipVisible(false);
  };
  
  // Handle define text action
  const handleDefineText = (text: string) => {
    
    // Ensure we have the offsets from selectedRange
    if (!selectedRange) {
      console.error('No selected range available for definition');
      return;
    }
    
    setDefinitionWord(text);
    setSavedDefinition(null); // Clear any saved definition
    setDefinitionPosition(tooltipPosition);
    setDefinitionVisible(true);
    setTooltipVisible(false);
  };

  // Handle creating a rabbithole conversation
  const handleCreateRabbithole = (text: string, startOffset: number, endOffset: number) => {
    if (onCreateRabbithole) {
      // Use the actual selection range data if available, otherwise use provided offsets
      if (selectedRange) {
        onCreateRabbithole(selectedRange.text, selectedRange.startOffset, selectedRange.endOffset);
      } else {
        onCreateRabbithole(text, startOffset, endOffset);
      }
    }
    setTooltipVisible(false);
  };
  
  // Handle rabbithole highlight click
  const handleRabbitholeClick = useCallback((
    id: string, 
    text: string, 
    startOffset: number, 
    endOffset: number
  ) => {
    if (onRabbitholeClick) {
      onRabbitholeClick(id, text, startOffset, endOffset);
    }
  }, [onRabbitholeClick]);
  
  // Handle saved definition click (from highlight)
  const handleSavedDefinitionClick = useCallback((term: string, definition: string, startOffset: number, endOffset: number, event: React.MouseEvent) => {
    setDefinitionWord(term);
    setSavedDefinition(definition);
    setDefinitionOffsets({ startOffset, endOffset });
    // Position at mouse position
    const mousePos = { x: event.clientX, y: event.clientY };
    setDefinitionPosition(mousePos);
    setDefinitionVisible(true);
  }, []);
  
  // Handle when a new definition is saved
  const handleDefinitionSaved = (term: string, definition: string, startOffset: number, endOffset: number, fullResponse?: any) => {
    
    // Update block metadata optimistically using API response
    if (fullResponse && fullResponse.text_start_offset !== undefined && onUpdateBlockMetadata) {
      const definitionKey = `${startOffset}-${endOffset}`;
      const newMetadata = {
        definitions: {
          ...metadata?.definitions,
          [definitionKey]: {
            term: fullResponse.term,
            definition: fullResponse.definition,
            text_start_offset: fullResponse.text_start_offset,
            text_end_offset: fullResponse.text_end_offset,
            created_at: fullResponse.created_at
          }
        }
      };
      onUpdateBlockMetadata(blockId, newMetadata);
    }
  };

  // Handle annotation text action (from tooltip)
  const handleAnnotateText = (text: string) => {
    
    // Ensure we have the offsets from selectedRange
    if (!selectedRange) {
      console.error('No selected range available for annotation');
      return;
    }
    
    setEditingAnnotation(null); // Clear any existing annotation
    setAnnotationPosition(tooltipPosition);
    setAnnotationVisible(true);
    setTooltipVisible(false);
  };

  // Handle annotation click (from highlight)
  const handleAnnotationClick = useCallback((annotation: any, event: React.MouseEvent) => {
    
    // Set up the selectedRange based on the annotation's stored offsets
    setSelectedRange({
      text: annotation.text,
      startOffset: annotation.text_start_offset,
      endOffset: annotation.text_end_offset
    });
    
    setEditingAnnotation({
      id: annotation.id,
      note: annotation.note,
      created_at: annotation.created_at,
      updated_at: annotation.updated_at
    });
    // Position at mouse position
    const mousePos = { x: event.clientX, y: event.clientY };
    setAnnotationPosition(mousePos);
    setAnnotationVisible(true);
  }, []);

  // Handle annotation save
  const handleAnnotationSave = async (note: string) => {
    if (!selectedRange) {
      console.error('No selected range available for annotation save');
      return;
    }

    try {
      const result = await documentApi.createAnnotation(
        documentId,
        blockId,
        selectedRange.text,
        note,
        selectedRange.startOffset,
        selectedRange.endOffset
      );
      
      // Update block metadata optimistically using API response
      if (result && 'id' in result && onUpdateBlockMetadata) {
        // API returned annotation data, update block metadata immediately
        const annotationKey = `${selectedRange.startOffset}-${selectedRange.endOffset}`;
        const newMetadata = {
          annotations: {
            ...metadata?.annotations,
            [annotationKey]: {
              id: result.id,
              text: result.text,
              note: result.note,
              text_start_offset: result.text_start_offset,
              text_end_offset: result.text_end_offset,
              created_at: result.created_at,
              updated_at: result.updated_at
            }
          }
        };
        onUpdateBlockMetadata(blockId, newMetadata);
      }
    } catch (error) {
      console.error('Failed to save annotation:', error);
      throw error; // Let the component handle the error
    }
  };

  // Handle annotation delete
  const handleAnnotationDelete = async () => {
    if (!selectedRange) {
      console.error('No selected range available for annotation delete');
      return;
    }

    try {
      await documentApi.deleteAnnotation(
        documentId,
        blockId,
        selectedRange.text,
        selectedRange.startOffset,
        selectedRange.endOffset
      );
      
      // Update block metadata by removing the annotation
      if (onUpdateBlockMetadata) {
        const annotationKey = `${selectedRange.startOffset}-${selectedRange.endOffset}`;
        const currentAnnotations = metadata?.annotations || {};
        const { [annotationKey]: deleted, ...remainingAnnotations } = currentAnnotations;
        const newMetadata = {
          annotations: Object.keys(remainingAnnotations).length > 0 ? remainingAnnotations : undefined
        };
        onUpdateBlockMetadata(blockId, newMetadata);
      }
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      throw error; // Let the component handle the error
    }
  };
  
  // Handle clicks outside of tooltips to close them
  const handleClick = (e: React.MouseEvent) => {
    // If clicking on the content (not a highlight), close tooltips
    if ((e.target as HTMLElement).closest('.rabbithole-highlight, .definition-highlight, .annotation-highlight')) {
      // Don't close tooltips if clicking a highlight
      return;
    }
    
    // Don't clear selection if annotation editor is open
    if (annotationVisible) {
      return;
    }
    
    // Close tooltips
    setTooltipVisible(false);
    setDefinitionVisible(false);
    setAnnotationVisible(false);
  };
  
  return (
    <div ref={blockRef} className="text-renderer relative">
      <SelectionManager onTextSelected={handleTextSelected}>
        <div ref={contentRef} onClick={handleClick}>
          <TextContent 
            htmlContent={htmlContent}
            blockType={blockType}
            processedContent={htmlContent}
            onClickHighlight={() => {}}
            getBlockClassName={getBlockClassName}
            customStyle={customStyle}
          />
        </div>
      </SelectionManager>
      
      {/* Annotation highlights overlay (rendered first, lowest z-index) */}
      {metadata?.annotations && (
        <ReactAnnotationHighlight
          contentRef={contentRef as React.RefObject<HTMLElement>}
          annotations={metadata.annotations}
          onAnnotationClick={handleAnnotationClick}
          rabbitholeHighlights={rabbitholeHighlights || []}
          definitions={metadata?.definitions || {}}
        />
      )}

      {/* Definition highlights overlay (rendered before rabbithole so rabbithole is on top) */}
      {metadata?.definitions && (
        <ReactDefinitionHighlight
          contentRef={contentRef as React.RefObject<HTMLElement>}
          definitions={metadata.definitions}
          onDefinitionClick={handleSavedDefinitionClick}
          rabbitholeHighlights={rabbitholeHighlights}
        />
      )}
      
      {/* Rabbithole highlights overlay */}
      <ReactRabbitholeHighlight
        contentRef={contentRef as React.RefObject<HTMLElement>}
        highlights={rabbitholeHighlights}
        onHighlightClick={handleRabbitholeClick}
        definitions={metadata?.definitions}
      />
      
      {/* Text selection tooltip */}
      {tooltipVisible && createPortal(
        <TextSelectionTooltip
          isVisible={true}
          position={tooltipPosition}
          selectedText={selectedText}
          onAddToChat={handleAddToChat}
          onDefine={handleDefineText}
          onCreateRabbithole={handleCreateRabbithole}
          onAnnotate={handleAnnotateText}
          onClose={() => {
            setTooltipVisible(false);
          } }
          documentId={documentId} 
          blockId={blockId}
        />,
        document.body
      )}
      
      {definitionVisible && (selectedRange || definitionOffsets) && createPortal(
        <DefinitionPopup
          isVisible={definitionVisible}
          term={definitionWord}
          textStartOffset={definitionOffsets?.startOffset || selectedRange?.startOffset || 0}
          textEndOffset={definitionOffsets?.endOffset || selectedRange?.endOffset || 0}
          position={definitionPosition}
          savedDefinition={savedDefinition || undefined}
          onClose={() => {
            setDefinitionVisible(false);
            setSavedDefinition(null);
            setDefinitionOffsets(null);
          }}
          onDefinitionSaved={handleDefinitionSaved}
          documentId={documentId}
          blockId={blockId}
        />,
        document.body
      )}
      
      {/* Annotation editor */}
      {annotationVisible && selectedRange && createPortal(
        <AnnotationEditor
          isVisible={annotationVisible}
          position={annotationPosition}
          selectedText={selectedRange.text}
          textStartOffset={selectedRange.startOffset}
          textEndOffset={selectedRange.endOffset}
          documentId={documentId}
          blockId={blockId}
          existingAnnotation={editingAnnotation}
          onClose={() => {
            setAnnotationVisible(false);
            setEditingAnnotation(null);
          }}
          onSave={handleAnnotationSave}
          onDelete={editingAnnotation ? handleAnnotationDelete : undefined}
        />,
        document.body
      )}
    </div>
  );
};

export default TextRenderer;