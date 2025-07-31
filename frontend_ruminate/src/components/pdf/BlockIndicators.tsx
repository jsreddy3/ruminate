import React, { useState } from 'react';
import IndicatorBadge from './IndicatorBadge';
import IndicatorLayout from './IndicatorLayout';
import { INDICATOR_CONFIGS } from './indicatorConfig';

interface BlockIndicatorsProps {
  // Legacy boolean props for backward compatibility
  hasConversations?: boolean;
  hasDefinitions?: boolean;
  hasAnnotations?: boolean;
  hasGeneratedNotes?: boolean;
  conversationCount?: number;
  definitionCount?: number;
  annotationCount?: number;
  generatedNoteCount?: number;
  
  // New data props
  conversationsData?: string[];
  definitionsData?: Record<string, any>;
  annotationsData?: any[];
  generatedNotesData?: any[];
  
  // Click handlers
  onConversationClick?: (conversationId: string) => void;
  onDefinitionClick?: (definitionKey: string, definition: any) => void;
  onAnnotationClick?: (annotation: any) => void;
  onGeneratedNoteClick?: (note: any) => void;
  
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function BlockIndicators({
  hasConversations = false,
  hasDefinitions = false,
  hasAnnotations = false,
  hasGeneratedNotes = false,
  conversationsData,
  definitionsData,
  annotationsData,
  generatedNotesData,
  onConversationClick,
  onDefinitionClick,
  onAnnotationClick,
  onGeneratedNoteClick,
  position = 'top-right'
}: BlockIndicatorsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Derive state from data if available, fallback to boolean props
  const hasConversationsActual = conversationsData ? conversationsData.length > 0 : hasConversations;
  const hasDefinitionsActual = definitionsData ? Object.keys(definitionsData).length > 0 : hasDefinitions;
  const hasAnnotationsActual = annotationsData ? annotationsData.length > 0 : hasAnnotations;
  const hasGeneratedNotesActual = generatedNotesData ? generatedNotesData.length > 0 : hasGeneratedNotes;

  // Calculate counts
  const conversationCount = conversationsData?.length || 0;
  const definitionCount = definitionsData ? Object.keys(definitionsData).length : 0;
  const annotationCount = annotationsData?.length || 0;
  const generatedNoteCount = generatedNotesData?.length || 0;

  // Map props to indicator state
  const indicatorState = {
    generatedNotes: hasGeneratedNotesActual,
    annotations: hasAnnotationsActual,
    definitions: hasDefinitionsActual,
    conversations: hasConversationsActual
  };

  // Filter to only visible indicators
  const visibleIndicators = INDICATOR_CONFIGS.filter(config => indicatorState[config.key as keyof typeof indicatorState]);
  
  if (visibleIndicators.length === 0) return null;

  const offsetPixels = 6; // Clean spacing for visual clarity
  const expandedOffsetPixels = 28; // Expanded spacing for clear separation

  // Get click handler for each indicator type
  const getClickHandler = (key: string) => {
    switch (key) {
      case 'conversations':
        return onConversationClick ? () => {
          // For now, click the first conversation if available
          if (conversationsData && conversationsData.length > 0) {
            onConversationClick(conversationsData[0]);
          }
        } : undefined;
      case 'definitions':
        return onDefinitionClick ? () => {
          // Click the first definition if available
          if (definitionsData) {
            const firstKey = Object.keys(definitionsData)[0];
            if (firstKey) {
              onDefinitionClick(firstKey, definitionsData[firstKey]);
            }
          }
        } : undefined;
      case 'annotations':
        return onAnnotationClick ? () => {
          // Click the first annotation if available
          if (annotationsData && annotationsData.length > 0) {
            onAnnotationClick(annotationsData[0]);
          }
        } : undefined;
      case 'generatedNotes':
        return onGeneratedNoteClick ? () => {
          // Click the first generated note if available
          if (generatedNotesData && generatedNotesData.length > 0) {
            onGeneratedNoteClick(generatedNotesData[0]);
          }
        } : undefined;
      default:
        return undefined;
    }
  };

  // Get count for each indicator type
  const getCount = (key: string) => {
    switch (key) {
      case 'conversations': return conversationCount;
      case 'definitions': return definitionCount;
      case 'annotations': return annotationCount;
      case 'generatedNotes': return generatedNoteCount;
      default: return 0;
    }
  };

  return (
    <IndicatorLayout 
      position={position} 
      type="icon" 
      visibleCount={visibleIndicators.length}
      isExpanded={isExpanded}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {visibleIndicators.map((config, index) => {
        const count = getCount(config.key);
        return (
          <IndicatorBadge
            key={config.key}
            type="icon"
            color={config.color}
            gradient={config.gradient}
            glowColor={config.glowColor}
            icon={config.icon}
            title={`${config.title}${count > 0 ? ` (${count})` : ''}`}
            delay={config.delay}
            position={{
              left: `${index * (isExpanded ? expandedOffsetPixels : offsetPixels)}px`,
              zIndex: config.zIndex
            }}
            isExpanded={isExpanded}
            onClick={getClickHandler(config.key)}
            count={isExpanded ? count : 0}
          />
        );
      })}
    </IndicatorLayout>
  );
}

// Alternative minimalist dot indicators
export function BlockDotIndicators({
  hasConversations = false,
  hasDefinitions = false,
  hasAnnotations = false,
  hasGeneratedNotes = false,
  position = 'top-right'
}: BlockIndicatorsProps) {
  // Map props to indicator state
  const indicatorState = {
    generatedNotes: hasGeneratedNotes,
    annotations: hasAnnotations,
    definitions: hasDefinitions,
    conversations: hasConversations
  };

  // Filter to only visible indicators
  const visibleIndicators = INDICATOR_CONFIGS.filter(config => indicatorState[config.key as keyof typeof indicatorState]);
  
  if (visibleIndicators.length === 0) return null;

  const offsetPixels = 4; // Enhanced spacing for dot indicators

  return (
    <IndicatorLayout 
      position={position} 
      type="dot" 
      visibleCount={visibleIndicators.length}
    >
      {visibleIndicators.map((config, index) => (
        <IndicatorBadge
          key={config.key}
          type="dot"
          color={config.color}
          gradient={config.gradient}
          glowColor={config.glowColor}
          title={config.title}
          delay={config.delay}
          position={{
            left: `${index * offsetPixels}px`,
            zIndex: config.zIndex
          }}
        />
      ))}
    </IndicatorLayout>
  );
}