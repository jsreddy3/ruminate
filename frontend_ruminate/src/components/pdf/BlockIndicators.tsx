import React from 'react';
import { motion } from 'framer-motion';

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
  conversationCount = 0,
  definitionCount = 0,
  annotationCount = 0,
  generatedNoteCount = 0,
  position = 'top-right'
}: BlockIndicatorsProps) {
  if (!hasConversations && !hasDefinitions && !hasAnnotations && !hasGeneratedNotes) return null;

  // Position classes based on prop
  const positionClasses = {
    'top-right': 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
    'top-left': 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
    'bottom-right': 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
    'bottom-left': 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2'
  };

  // Calculate total width needed for layered icons
  const iconCount = [hasConversations, hasDefinitions, hasAnnotations, hasGeneratedNotes].filter(Boolean).length;
  const offsetPixels = 6; // How much each icon is offset
  const totalWidth = iconCount > 0 ? 20 + (iconCount - 1) * offsetPixels : 20;

  return (
    <div className={`absolute ${positionClasses[position]} pointer-events-none`} style={{ width: `${totalWidth}px`, height: '20px' }}>
      {/* Generated Notes indicator - Orange/Amber (front layer, leftmost) */}
      {hasGeneratedNotes && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.15 }}
          className="absolute"
          style={{ 
            left: '0px',
            zIndex: 4
          }}
        >
          <div 
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#f59e0b',  // amber-500
              borderRadius: '50%',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
            title="Has generated notes"
          >
            <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </motion.div>
      )}

      {/* User Annotation indicator - Yellow (second layer) */}
      {hasAnnotations && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.1 }}
          className="absolute"
          style={{ 
            left: hasGeneratedNotes ? `${offsetPixels}px` : '0px',
            zIndex: 3
          }}
        >
          <div 
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#eab308',  // yellow-500
              borderRadius: '50%',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
            title="Has user annotations"
          >
            <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
        </motion.div>
      )}

      {/* Definition indicator - Red (third layer) */}
      {hasDefinitions && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.05 }}
          className="absolute"
          style={{ 
            left: `${[hasGeneratedNotes, hasAnnotations].filter(Boolean).length * offsetPixels}px`,
            zIndex: 2
          }}
        >
          <div 
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#ef4444',  // red-500
              borderRadius: '50%',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
            title="Has definitions"
          >
            <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        </motion.div>
      )}

      {/* Conversation indicator - Purple (back layer, rightmost) */}
      {hasConversations && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute"
          style={{ 
            left: `${[hasGeneratedNotes, hasAnnotations, hasDefinitions].filter(Boolean).length * offsetPixels}px`,
            zIndex: 1
          }}
        >
          <div 
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#9333ea',  // purple-600
              borderRadius: '50%',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
            }}
            title="Has conversations"
          >
            <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        </motion.div>
      )}
    </div>
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
  if (!hasConversations && !hasDefinitions && !hasAnnotations && !hasGeneratedNotes) return null;

  const positionClasses = {
    'top-right': 'top-1 right-1',
    'top-left': 'top-1 left-1',
    'bottom-right': 'bottom-1 right-1',
    'bottom-left': 'bottom-1 left-1'
  };

  // Calculate total width needed for layered dots
  const iconCount = [hasConversations, hasDefinitions, hasAnnotations, hasGeneratedNotes].filter(Boolean).length;
  const offsetPixels = 3; // Smaller offset for dots
  const dotSize = 8; // 2 * 4px (w-2 h-2)
  const totalWidth = iconCount > 0 ? dotSize + (iconCount - 1) * offsetPixels : dotSize;

  return (
    <div className={`absolute ${positionClasses[position]}`} style={{ width: `${totalWidth}px`, height: `${dotSize}px` }}>
      {hasGeneratedNotes && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="absolute w-2 h-2 bg-amber-500 rounded-full shadow-sm"
          style={{ 
            left: '0px',
            zIndex: 4
          }}
          title="Has generated notes"
        />
      )}
      {hasAnnotations && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="absolute w-2 h-2 bg-yellow-500 rounded-full shadow-sm"
          style={{ 
            left: hasGeneratedNotes ? `${offsetPixels}px` : '0px',
            zIndex: 3
          }}
          title="Has user annotations"
        />
      )}
      {hasDefinitions && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="absolute w-2 h-2 bg-red-500 rounded-full shadow-sm"
          style={{ 
            left: `${[hasGeneratedNotes, hasAnnotations].filter(Boolean).length * offsetPixels}px`,
            zIndex: 2
          }}
          title="Has definitions"
        />
      )}
      {hasConversations && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute w-2 h-2 bg-purple-500 rounded-full shadow-sm"
          style={{ 
            left: `${[hasGeneratedNotes, hasAnnotations, hasDefinitions].filter(Boolean).length * offsetPixels}px`,
            zIndex: 1
          }}
          title="Has conversations"
        />
      )}
    </div>
  );
}