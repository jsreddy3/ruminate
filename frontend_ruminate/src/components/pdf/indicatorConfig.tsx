import React from 'react';
import { 
  ChatBubbleLeftEllipsisIcon,
  BookOpenIcon,
  PencilSquareIcon
} from '@heroicons/react/24/solid';

// Scholarly icon wrapper component that applies refined styling
const ScholarlyIcon: React.FC<{ children: React.ReactNode; variant?: 'warm' | 'elegant' | 'classic' }> = ({ 
  children, 
  variant = 'classic' 
}) => {
  const getIconStyles = () => {
    switch (variant) {
      case 'warm':
        return {
          filter: 'drop-shadow(0 1px 2px rgba(139, 69, 19, 0.4))',
          opacity: 0.92,
        };
      case 'elegant':
        return {
          filter: 'drop-shadow(0 1px 1px rgba(44, 56, 48, 0.3))',
          opacity: 0.88,
        };
      case 'classic':
      default:
        return {
          filter: 'drop-shadow(0 1px 1.5px rgba(175, 95, 55, 0.35))',
          opacity: 0.9,
        };
    }
  };

  return (
    <div style={getIconStyles()}>
      {React.isValidElement(children) && children.type !== 'div' 
        ? React.cloneElement(children as React.ReactElement<any>, {
            style: {
              strokeWidth: 1.5,
              ...((children as React.ReactElement<any>).props?.style || {})
            }
          })
        : children
      }
    </div>
  );
};

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
    color: '#6b7280', // casual gray-blue
    gradient: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
    glowColor: 'rgba(107, 114, 128, 0.3)',
    title: 'Discussion Threads',
    icon: (
      <ScholarlyIcon variant="elegant">
        <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
      </ScholarlyIcon>
    ),
    delay: 0,
    zIndex: 4
  },
  {
    key: 'definitions',
    color: '#798779', // library-sage (shifted from forest to sage)
    gradient: 'linear-gradient(135deg, #798779 0%, #6d7a6d 100%)',
    glowColor: 'rgba(121, 135, 121, 0.3)',
    title: 'Term Definitions',
    icon: (
      <ScholarlyIcon variant="classic">
        <BookOpenIcon className="w-4 h-4" />
      </ScholarlyIcon>
    ),
    delay: 0.05,
    zIndex: 3
  },
  {
    key: 'annotations',
    color: '#af5f37', // library-mahogany
    gradient: 'linear-gradient(135deg, #af5f37 0%, #8b4513 100%)',
    glowColor: 'rgba(175, 95, 55, 0.3)',
    title: 'Personal Annotations',
    icon: (
      <ScholarlyIcon variant="warm">
        <PencilSquareIcon className="w-4 h-4" />
      </ScholarlyIcon>
    ),
    delay: 0.1,
    zIndex: 2
  },
  {
    key: 'generatedNotes',
    color: '#f9cf5f', // library-gold
    gradient: 'linear-gradient(135deg, #f9cf5f 0%, #e6b84f 100%)',
    glowColor: 'rgba(249, 207, 95, 0.3)',
    title: 'AI-Generated Insights',
    icon: (
      <ScholarlyIcon variant="warm">
        <div style={{ fontSize: '14px', fontFamily: 'serif' }}>❋</div>
      </ScholarlyIcon>
    ),
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