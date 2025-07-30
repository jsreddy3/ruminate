import React from 'react';

export interface IndicatorConfig {
  key: string;
  color: string;
  gradient: string;
  title: string;
  icon: React.ReactNode;
  delay: number;
  zIndex: number;
  glowColor: string;
}

// Clean, readable scholarly icons optimized for small sizes
const ScholarlyInsightIcon = (
  <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const QuillAnnotationIcon = (
  <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 24 24">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);

const ManuscriptIcon = (
  <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 24 24">
    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
  </svg>
);

const ScholarlyDiscourseIcon = (
  <svg style={{ width: '16px', height: '16px' }} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
  </svg>
);

// Clean library-themed indicator configurations in display order (front to back)
export const INDICATOR_CONFIGS: IndicatorConfig[] = [
  {
    key: 'generatedNotes',
    color: '#f9cf5f', // library-gold
    gradient: 'linear-gradient(135deg, #f9cf5f 0%, #e6b84f 100%)',
    glowColor: 'rgba(249, 207, 95, 0.3)',
    title: 'AI-Generated Insights',
    icon: ScholarlyInsightIcon,
    delay: 0.15,
    zIndex: 4
  },
  {
    key: 'annotations',
    color: '#af5f37', // library-mahogany
    gradient: 'linear-gradient(135deg, #af5f37 0%, #8b4513 100%)',
    glowColor: 'rgba(175, 95, 55, 0.3)',
    title: 'Personal Annotations',
    icon: QuillAnnotationIcon,
    delay: 0.1,
    zIndex: 3
  },
  {
    key: 'definitions',
    color: '#5a735f', // library-forest
    gradient: 'linear-gradient(135deg, #5a735f 0%, #4a5d4f 100%)',
    glowColor: 'rgba(90, 115, 95, 0.3)',
    title: 'Term Definitions',
    icon: ManuscriptIcon,
    delay: 0.05,
    zIndex: 2
  },
  {
    key: 'conversations',
    color: '#798779', // library-sage
    gradient: 'linear-gradient(135deg, #798779 0%, #6b7069 100%)',
    glowColor: 'rgba(121, 135, 121, 0.3)',
    title: 'Discussion Threads',
    icon: ScholarlyDiscourseIcon,
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