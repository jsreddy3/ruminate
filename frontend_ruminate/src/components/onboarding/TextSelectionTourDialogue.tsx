import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, Sparkles } from 'lucide-react';
import { AnimatedTextSelection } from './AnimatedTextSelection';

interface TextSelectionTourDialogueProps {
  isVisible: boolean;
  onComplete: () => void;
  position?: { top?: string; left?: string; right?: string; bottom?: string };
  overlayBlock?: boolean; // New prop to position over the block overlay
}

export const TextSelectionTourDialogue: React.FC<TextSelectionTourDialogueProps> = ({
  isVisible,
  onComplete,
  position = { top: '20%', left: '20%' },
  overlayBlock = false
}) => {
  const hasShownRef = useRef(false);
  const [shouldShowPointer, setShouldShowPointer] = useState(false);
  
  console.log('TextSelectionTourDialogue render:', { isVisible, overlayBlock, position });
  
  useEffect(() => {
    if (isVisible && !hasShownRef.current) {
      hasShownRef.current = true;
      const timer = setTimeout(() => {
        setShouldShowPointer(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);
  
  if (!isVisible) {
    console.log('TextSelectionTourDialogue: not visible, returning null');
    return null;
  }
  
  console.log('TextSelectionTourDialogue: about to render JSX');
  
  const content = (
    <>
      {/* DEBUG: Simple visible test box */}
      <div className="fixed top-10 left-10 bg-green-500 text-white p-4 rounded z-[9999]">
        DIALOGUE IS RENDERING!
      </div>
      
      {/* Dialogue box - floating freely at top level */}
      <div
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[9999] pointer-events-auto"
        style={{
          backgroundColor: 'red',
          color: 'white',
          padding: '20px',
          borderRadius: '10px',
          minWidth: '300px',
          maxWidth: '400px',
          textAlign: 'center'
        }}
      >
        <h2>TEXT SELECTION TOUR</h2>
        <p>Try selecting some text!</p>
      </div>
    </>
  );

  // Use portal to render outside the current DOM tree to bypass any CSS filters/stacking contexts
  return createPortal(content, document.body);
};