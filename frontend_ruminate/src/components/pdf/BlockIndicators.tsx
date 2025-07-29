import React from 'react';
import { motion } from 'framer-motion';

interface BlockIndicatorsProps {
  hasConversations?: boolean;
  hasDefinitions?: boolean;
  conversationCount?: number;
  definitionCount?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export default function BlockIndicators({
  hasConversations = false,
  hasDefinitions = false,
  conversationCount = 0,
  definitionCount = 0,
  position = 'top-right'
}: BlockIndicatorsProps) {
  if (!hasConversations && !hasDefinitions) return null;

  // Position classes based on prop
  const positionClasses = {
    'top-right': 'top-0 right-0 translate-x-1/2 -translate-y-1/2',
    'top-left': 'top-0 left-0 -translate-x-1/2 -translate-y-1/2',
    'bottom-right': 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
    'bottom-left': 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2'
  };

  return (
    <div className={`absolute ${positionClasses[position]} flex gap-1 pointer-events-none`}>
      {/* Conversation indicator - Purple */}
      {hasConversations && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="relative"
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <svg style={{ width: '12px', height: '12px' }} fill="white" stroke="white" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        </motion.div>
      )}

      {/* Definition indicator - Red */}
      {hasDefinitions && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 30, delay: 0.05 }}
          className="relative"
        >
          <div 
            style={{
              width: '20px',
              height: '20px',
              backgroundColor: '#ef4444',  // red-500
              borderRadius: '50%',
              border: '2px solid #fecaca',  // red-200
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            <svg style={{ width: '12px', height: '12px' }} fill="#fee2e2" stroke="#fee2e2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          {definitionCount > 1 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-700 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">{definitionCount}</span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

// Alternative minimalist dot indicators
export function BlockDotIndicators({
  hasConversations = false,
  hasDefinitions = false,
  position = 'top-right'
}: BlockIndicatorsProps) {
  if (!hasConversations && !hasDefinitions) return null;

  const positionClasses = {
    'top-right': 'top-1 right-1',
    'top-left': 'top-1 left-1',
    'bottom-right': 'bottom-1 right-1',
    'bottom-left': 'bottom-1 left-1'
  };

  return (
    <div className={`absolute ${positionClasses[position]} flex gap-1`}>
      {hasConversations && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="w-2 h-2 bg-purple-500 rounded-full shadow-sm"
          title="Has conversations"
        />
      )}
      {hasDefinitions && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2, delay: 0.05 }}
          className="w-2 h-2 bg-red-500 rounded-full shadow-sm"
          title="Has definitions"
        />
      )}
    </div>
  );
}