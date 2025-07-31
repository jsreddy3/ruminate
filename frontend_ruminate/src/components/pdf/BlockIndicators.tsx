import React, { useState } from 'react';
import IndicatorBadge from './IndicatorBadge';
import IndicatorLayout from './IndicatorLayout';
import { INDICATOR_CONFIGS } from './indicatorConfig';

interface BlockIndicatorsProps {
  hasConversations?: boolean;
  hasDefinitions?: boolean;
  hasAnnotations?: boolean;
  hasGeneratedNotes?: boolean;
  conversationCount?: number;
  definitionCount?: number;
  annotationCount?: number;
  generatedNoteCount?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function BlockIndicators({
  hasConversations = false,
  hasDefinitions = false,
  hasAnnotations = false,
  hasGeneratedNotes = false,
  position = 'top-right'
}: BlockIndicatorsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const offsetPixels = 6; // Clean spacing for visual clarity
  const expandedOffsetPixels = 28; // Expanded spacing for clear separation

  return (
    <IndicatorLayout 
      position={position} 
      type="icon" 
      visibleCount={visibleIndicators.length}
      isExpanded={isExpanded}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {visibleIndicators.map((config, index) => (
        <IndicatorBadge
          key={config.key}
          type="icon"
          color={config.color}
          gradient={config.gradient}
          glowColor={config.glowColor}
          icon={config.icon}
          title={config.title}
          delay={config.delay}
          position={{
            left: `${index * (isExpanded ? expandedOffsetPixels : offsetPixels)}px`,
            zIndex: config.zIndex
          }}
          isExpanded={isExpanded}
        />
      ))}
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