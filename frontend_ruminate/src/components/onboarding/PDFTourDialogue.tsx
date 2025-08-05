import React from 'react';
import { FileText } from 'lucide-react';
import StepCounter from './StepCounter';
import BasePopover from '../common/BasePopover';

interface PDFTourDialogueProps {
  isVisible: boolean;
  targetRect: { x: number; y: number; width: number; height: number } | null;
  scale: number;
  onSkip?: () => void;
}

export const PDFTourDialogue: React.FC<PDFTourDialogueProps> = ({
  isVisible,
  targetRect,
  scale,
  onSkip
}) => {
  
  if (!targetRect) {
    return null;
  }
  
  // Determine best position based on available space
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const popoverWidth = 320;
  const popoverHeight = 160; // Approximate height
  const padding = 20;
  
  // Check if there's enough space to the right
  const spaceOnRight = viewportWidth - (targetRect.x + targetRect.width);
  const canPlaceRight = spaceOnRight >= (popoverWidth + padding * 2);
  
  // Check if there's enough space to the left
  const spaceOnLeft = targetRect.x;
  const canPlaceLeft = spaceOnLeft >= (popoverWidth + padding * 2);
  
  // Determine position and arrow direction
  let dialogueX: number;
  let dialogueY = targetRect.y + (targetRect.height / 2) - 80; // Center vertically
  let arrowDirection: 'left' | 'right' | 'top' | 'bottom' = 'left';
  
  if (canPlaceRight) {
    // Place to the right with arrow pointing left
    dialogueX = targetRect.x + targetRect.width + padding;
    arrowDirection = 'left';
  } else if (canPlaceLeft) {
    // Place to the left with arrow pointing right
    dialogueX = targetRect.x - popoverWidth - padding;
    arrowDirection = 'right';
  } else {
    // Place above or below if no horizontal space
    dialogueX = Math.max(padding, Math.min(targetRect.x + (targetRect.width / 2) - (popoverWidth / 2), viewportWidth - popoverWidth - padding));
    
    const spaceAbove = targetRect.y;
    const spaceBelow = viewportHeight - (targetRect.y + targetRect.height);
    
    if (spaceBelow >= popoverHeight + padding * 2) {
      // Place below with arrow pointing up
      dialogueY = targetRect.y + targetRect.height + padding;
      arrowDirection = 'top';
    } else {
      // Place above with arrow pointing down
      dialogueY = targetRect.y - popoverHeight - padding;
      arrowDirection = 'bottom';
    }
  }
  
  return (
    <BasePopover
      isVisible={isVisible}
      position={{ x: dialogueX, y: dialogueY }}
      onClose={() => {}} // No close action for step 3
      showCloseButton={false}
      closeOnClickOutside={false}
      initialWidth={320}
      initialHeight="auto"
      className="pointer-events-none"
      preventOverflow={false}
    >
      <div className="relative">
        {/* Dynamic arrow based on position */}
        {arrowDirection === 'left' && (
          <div className="absolute -left-[18px] top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="12" height="20" viewBox="0 0 12 20" className="text-library-mahogany/50">
              <path d="M12 10 L0 2 L0 18 Z" fill="currentColor" />
            </svg>
          </div>
        )}
        {arrowDirection === 'right' && (
          <div className="absolute -right-[18px] top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="12" height="20" viewBox="0 0 12 20" className="text-library-mahogany/50">
              <path d="M0 10 L12 2 L12 18 Z" fill="currentColor" />
            </svg>
          </div>
        )}
        {arrowDirection === 'top' && (
          <div className="absolute left-1/2 -top-[18px] -translate-x-1/2 pointer-events-none">
            <svg width="20" height="12" viewBox="0 0 20 12" className="text-library-mahogany/50">
              <path d="M10 12 L2 0 L18 0 Z" fill="currentColor" />
            </svg>
          </div>
        )}
        {arrowDirection === 'bottom' && (
          <div className="absolute left-1/2 -bottom-[18px] -translate-x-1/2 pointer-events-none">
            <svg width="20" height="12" viewBox="0 0 20 12" className="text-library-mahogany/50">
              <path d="M10 0 L2 12 L18 12 Z" fill="currentColor" />
            </svg>
          </div>
        )}

        {/* Main dialogue content */}
        <div className="relative">
          {/* Paper texture overlay */}
          <div className="absolute inset-0 rounded-book opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5' /%3E%3C/svg%3E")`
            }}
          />
          
          <div className="relative overflow-hidden p-5"
            style={{ 
              backgroundColor: 'rgba(158, 86, 50, 0.24)',
              backgroundImage: 'linear-gradient(145deg, rgba(215, 184, 140, 0.15) 0%, rgba(158, 86, 50, 0.12) 40%, rgba(139, 155, 132, 0.08) 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.18)',
            }}>
            {/* Multiple glass layers for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.15] via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-library-gold/[0.08] rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-library-mahogany/[0.02] to-transparent pointer-events-none" />
            
            <div className="relative z-10">
              <StepCounter currentStep={3} totalSteps={11} className="mb-4" />
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <FileText className="w-5 h-5 text-library-mahogany/80" strokeWidth={1.5} />
                </div>
              
                <div className="flex-1">
                  <p className="text-library-mahogany/90 font-iowan font-medium leading-relaxed text-[15px] tracking-wide"
                     style={{ fontFamily: '"Iowan Old Style", Georgia, serif' }}>
                    Tap a block of text to start reading
                  </p>
                  {onSkip && (
                    <button
                      onClick={onSkip}
                      className="mt-2 text-xs text-library-mahogany/60 hover:text-library-mahogany/80 underline transition-colors"
                      style={{ pointerEvents: 'auto' }}
                    >
                      Not working? Click here
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </BasePopover>
  );
};