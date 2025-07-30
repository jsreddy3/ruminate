import React from 'react';

export interface IndicatorConfig {
  key: string;
  color: string;
  title: string;
  icon: React.ReactNode;
  delay: number;
  zIndex: number;
}

// SVG icons as React nodes
const LightbulbIcon = (
  <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

const AnnotationIcon = (
  <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const BookIcon = (
  <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const ConversationIcon = (
  <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
  </svg>
);

// Indicator configurations in display order (front to back)
export const INDICATOR_CONFIGS: IndicatorConfig[] = [
  {
    key: 'generatedNotes',
    color: '#f59e0b', // amber-500
    title: 'Has generated notes',
    icon: LightbulbIcon,
    delay: 0.15,
    zIndex: 4
  },
  {
    key: 'annotations',
    color: '#eab308', // yellow-500
    title: 'Has user annotations',
    icon: AnnotationIcon,
    delay: 0.1,
    zIndex: 3
  },
  {
    key: 'definitions',
    color: '#ef4444', // red-500
    title: 'Has definitions',
    icon: BookIcon,
    delay: 0.05,
    zIndex: 2
  },
  {
    key: 'conversations',
    color: '#9333ea', // purple-600
    title: 'Has conversations',
    icon: ConversationIcon,
    delay: 0,
    zIndex: 1
  }
];

// Position classes mapping
export const POSITION_CLASSES = {
  'top-right': 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
  'top-left': 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
  'bottom-right': 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
  'bottom-left': 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2'
} as const;

export const DOT_POSITION_CLASSES = {
  'top-right': 'top-1 right-1',
  'top-left': 'top-1 left-1',
  'bottom-right': 'bottom-1 right-1',
  'bottom-left': 'bottom-1 left-1'
} as const;