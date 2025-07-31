import React from 'react';
import { 
  ChatBubbleLeftEllipsisIcon,
  BookOpenIcon,
  PencilSquareIcon,
  SparklesIcon
} from '@heroicons/react/24/solid';

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


// Indicator configurations in display order (front to back)
export const INDICATOR_CONFIGS: IndicatorConfig[] = [
  {
    key: 'conversations',
    color: '#4a90e2', // blue
    gradient: 'linear-gradient(135deg, #4a90e2 0%, #357abd 100%)',
    glowColor: 'rgba(74, 144, 226, 0.3)',
    title: 'Discussion Threads',
    icon: <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />,
    delay: 0,
    zIndex: 4
  },
  {
    key: 'definitions',
    color: '#5a735f', // library-forest
    gradient: 'linear-gradient(135deg, #5a735f 0%, #4a5d4f 100%)',
    glowColor: 'rgba(90, 115, 95, 0.3)',
    title: 'Term Definitions',
    icon: <BookOpenIcon className="w-4 h-4" />,
    delay: 0.05,
    zIndex: 3
  },
  {
    key: 'annotations',
    color: '#af5f37', // library-mahogany
    gradient: 'linear-gradient(135deg, #af5f37 0%, #8b4513 100%)',
    glowColor: 'rgba(175, 95, 55, 0.3)',
    title: 'Personal Annotations',
    icon: <PencilSquareIcon className="w-4 h-4" />,
    delay: 0.1,
    zIndex: 2
  },
  {
    key: 'generatedNotes',
    color: '#f9cf5f', // library-gold
    gradient: 'linear-gradient(135deg, #f9cf5f 0%, #e6b84f 100%)',
    glowColor: 'rgba(249, 207, 95, 0.3)',
    title: 'AI-Generated Insights',
    icon: <SparklesIcon className="w-4 h-4" />,
    delay: 0.15,
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