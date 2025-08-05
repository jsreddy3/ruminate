import React from 'react';
import BasePopover from '../../common/BasePopover';
import StepCounter from '../../onboarding/StepCounter';
import { AnimatedTextSelection } from '../../onboarding/AnimatedTextSelection';
import { Step5DefineModal } from '../../onboarding/Step5DefineModal';
import { PDFTourDialogue } from '../../onboarding/PDFTourDialogue';

interface OnboardingOverlaysProps {
  onboarding: any; // Using any to avoid complex type definition for now
  viewMode: 'pdf' | 'glossary' | 'annotations';
  isViewDropdownOpen: boolean;
  closeViewDropdown: () => void;
  handleViewModeSelect: (mode: 'pdf' | 'glossary' | 'annotations') => void;
  blocks?: any[]; // For finding onboarding target block
  scale?: number; // PDF scale for positioning
}

export function OnboardingOverlays({
  onboarding,
  viewMode,
  isViewDropdownOpen,
  closeViewDropdown,
  handleViewModeSelect,
  blocks = [],
  scale = 1,
}: OnboardingOverlaysProps) {
  const { onboardingState } = onboarding;
  
  // Calculate target rect for PDFTourDialogue
  const [targetRect, setTargetRect] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);
  
  React.useEffect(() => {
    if (onboardingState.currentStep === 3 && onboarding.onboardingTargetBlockId) {
      // Try to find the block element in the DOM
      const checkForBlock = () => {
        const blockElements = document.querySelectorAll(`[data-block-id="${onboarding.onboardingTargetBlockId}"]`);
        if (blockElements.length > 0) {
          const blockElement = blockElements[0];
          const rect = blockElement.getBoundingClientRect();
          setTargetRect({
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height
          });
        } else {
          // Fallback: show in center of screen
          setTargetRect({
            x: window.innerWidth / 2 - 100,
            y: window.innerHeight / 2,
            width: 200,
            height: 100
          });
        }
      };
      
      // Check immediately and then periodically
      checkForBlock();
      const interval = setInterval(checkForBlock, 500);
      
      return () => clearInterval(interval);
    } else {
      setTargetRect(null);
    }
  }, [onboardingState.currentStep, onboarding.onboardingTargetBlockId]);
  
  return (
    <>
      {/* View Mode Selector Popover */}
      <BasePopover
        isVisible={isViewDropdownOpen}
        position={onboarding.viewDropdownPosition || { x: 0, y: 0 }}
        onClose={() => {
          if (onboarding.canCloseViewDropdown()) {
            closeViewDropdown();
          }
        }}
        title="📄 View Mode"
        initialWidth={240}
        initialHeight="auto"
        minWidth={200}
        preventOverflow={true}
        offsetY={0}
      >
        <div className="p-3 space-y-2">
          <button
            onClick={() => {
              if (onboarding.canSelectViewMode()) {
                handleViewModeSelect('pdf');
              }
            }}
            className={onboarding.getViewModeOptionClassName('pdf', 'w-full flex items-center gap-3 px-3 py-2 rounded-book text-left font-serif text-sm transition-colors')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF Document
          </button>
          <button
            onClick={() => {
              if (onboarding.canSelectViewMode()) {
                handleViewModeSelect('glossary');
              }
            }}
            className={onboarding.getViewModeOptionClassName('glossary', 'w-full flex items-center gap-3 px-3 py-2 rounded-book text-left font-serif text-sm transition-colors')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Glossary
          </button>
          <button
            onClick={() => {
              if (onboarding.canSelectViewMode()) {
                handleViewModeSelect('annotations');
              }
            }}
            className={onboarding.getViewModeOptionClassName('annotations', 'w-full flex items-center gap-3 px-3 py-2 rounded-book text-left font-serif text-sm transition-colors')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Annotations & Notes
          </button>
        </div>
      </BasePopover>

      {/* Step 3 - PDF Tour Dialogue */}
      <PDFTourDialogue
        isVisible={onboardingState.isActive && onboardingState.currentStep === 3}
        targetRect={targetRect}
        scale={scale}
        onSkip={() => {
          // Find and click the target block
          if (onboarding.onboardingTargetBlockId) {
            const blockElement = document.querySelector(`[data-block-id="${onboarding.onboardingTargetBlockId}"]`);
            if (blockElement) {
              (blockElement as HTMLElement).click();
            } else {
              // If block still not found, find any clickable block on page 1
              const anyBlock = document.querySelector('.pdf-page-container[data-page-index="0"] [data-block-id]');
              if (anyBlock) {
                (anyBlock as HTMLElement).click();
              }
            }
          }
        }}
      />

      {/* Text Selection Onboarding Tour - Step 4 */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 4}
        position={{ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 120 }}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={400}
        initialHeight="auto"
        className="overflow-hidden"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-library-gold/[0.08] via-transparent to-library-gold/[0.12] pointer-events-none" />
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-library-gold/[0.15] rounded-full blur-xl pointer-events-none" />
          <div className="relative p-6">
            <StepCounter currentStep={4} totalSteps={11} className="mb-4" />
            <div className="flex items-start gap-4">
              <div className="mt-1 flex-shrink-0">
                <div className="relative">
                  <svg className="w-6 h-6 text-library-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.122 2.122" />
                  </svg>
                  <div className="absolute -top-0.5 -right-0.5">
                    <div className="w-2.5 h-2.5 bg-library-gold rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="font-serif text-lg font-semibold text-reading-primary mb-4 tracking-wide">
                  Select text to annotate!
                </h3>
                <div className="flex justify-center">
                  <AnimatedTextSelection
                    isVisible={true}
                    delay={1000}
                    targetText="Click and drag to see options"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </BasePopover>

      {/* Step 5 Tooltip Options Overview */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 5}
        position={{ x: window.innerWidth / 2 - 175, y: 100 }}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={350}
        initialHeight="auto"
        preventOverflow={true}
        title="🎨 Selection Options"
      >
        <div className="text-center p-6" data-step-5-popover>
          <StepCounter currentStep={5} totalSteps={11} className="mb-4" />
          <div className="w-12 h-12 mx-auto bg-library-gold-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </div>
          <h3 className="text-lg font-serif font-semibold text-reading-primary mb-3">
            Embed Notes in the Text
          </h3>
          <p className="text-reading-secondary text-sm mb-6 leading-relaxed">
            Like notes in a margin, you can create annotations, definitions, and more.
          </p>
          <button 
            onClick={onboarding.markTooltipOptionsComplete}
            className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-book transition-all duration-300 ring-4 ring-library-gold-400/70 shadow-2xl scale-110 hover:scale-115"
            style={{
              background: 'linear-gradient(135deg, #f9cf5f 0%, #edbe51 100%)',
              color: '#2c3830',
              borderColor: '#f9cf5f',
              animation: 'glow 2s ease-in-out infinite',
              boxShadow: '0 0 25px rgba(249, 207, 95, 0.9), 0 0 50px rgba(249, 207, 95, 0.5)'
            }}
          >
            Try it out
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </BasePopover>

      {/* Step 6 Create Chat Instructions */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 6}
        position={{ x: window.innerWidth / 2 - 150, y: 100 }}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={300}
        initialHeight="auto"
        preventOverflow={true}
      >
        <div className="text-center p-6" data-step-6-popover>
          <StepCounter currentStep={6} totalSteps={11} className="mb-4" />
          <Step5DefineModal
            isVisible={true}
            onComplete={onboarding.markDefineHighlightComplete}
          />
        </div>
      </BasePopover>

      {/* Step 7 Chat Focus Instructions */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 7}
        position={{ x: Math.min(window.innerWidth * 0.75, window.innerWidth - 200), y: window.innerHeight / 2 - 100 }}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={350}
        initialHeight="auto"
        preventOverflow={true}
      >
        <div className="text-center p-6" data-step-7-popover>
          <StepCounter currentStep={7} totalSteps={11} className="mb-4" />
          <div className="w-12 h-12 mx-auto bg-library-gold-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-lg font-serif font-semibold text-reading-primary mb-3">
            Chat About Your Selection
          </h3>
          <p className="text-reading-secondary text-sm mb-6 leading-relaxed">
            Ask questions here to get answers anchored in the text.
          </p>
          <button 
            onClick={onboarding.markChatFocusComplete}
            className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-book transition-all duration-300 ring-4 ring-library-gold-400/70 shadow-2xl scale-110 hover:scale-115"
            style={{
              background: 'linear-gradient(135deg, #f9cf5f 0%, #edbe51 100%)',
              color: '#2c3830',
              borderColor: '#f9cf5f',
              animation: 'glow 2s ease-in-out infinite',
              boxShadow: '0 0 25px rgba(249, 207, 95, 0.9), 0 0 50px rgba(249, 207, 95, 0.5)'
            }}
          >
            Continue
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </BasePopover>

      {/* Step 8 Close Block Instructions */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 8}
        position={onboarding.popoverPositions.step8}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={250}
        initialHeight="auto"
        preventOverflow={true}
      >
        <div className="text-center p-5" data-step-8-popover>
          <StepCounter currentStep={8} totalSteps={11} className="mb-3" />
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-serif font-semibold text-reading-primary">
                Close the Block
              </h3>
            </div>
            <p className="text-sm text-reading-secondary mt-1">
              Click the glowing X button
            </p>
          </div>
        </div>
      </BasePopover>

      {/* Step 9 View Mode Instructions */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 9}
        position={onboarding.popoverPositions.step9}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={350}
        initialHeight="auto"
        preventOverflow={true}
      >
        <div className="text-center p-6" data-step-9-popover>
          <StepCounter currentStep={9} totalSteps={11} className="mb-4" />
          <div className="flex items-center justify-center gap-3 mb-3">
            <h3 className="text-lg font-serif font-semibold text-reading-primary">
              Switch View Modes
            </h3>
          </div>
          <p className="text-reading-secondary text-sm leading-relaxed">
            Click the glowing button above to see viewing options
          </p>
        </div>
      </BasePopover>

      {/* Step 10 View Explanation */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 10}
        position={onboarding.popoverPositions.step10}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={350}
        initialHeight="auto"
        preventOverflow={true}
      >
        <div className="text-center p-6" data-step-10-popover>
          <StepCounter currentStep={10} totalSteps={11} className="mb-4" />
          <div className="w-12 h-12 mx-auto bg-library-gold-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-serif font-semibold text-reading-primary mb-3">
            After generating definitions or annotations, they will be visible in these other view modes.
          </h3>
          <button 
            onClick={onboarding.handleStep10Complete}
            className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-book transition-all duration-300 ring-4 ring-library-gold-400/70 shadow-2xl scale-110 hover:scale-115"
            style={{
              background: 'linear-gradient(135deg, #f9cf5f 0%, #edbe51 100%)',
              color: '#2c3830',
              borderColor: '#f9cf5f',
              animation: 'glow 2s ease-in-out infinite',
              boxShadow: '0 0 25px rgba(249, 207, 95, 0.9), 0 0 50px rgba(249, 207, 95, 0.5)'
            }}
          >
            Next
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </BasePopover>

      {/* Step 11 Onboarding Complete */}
      <BasePopover
        isVisible={onboardingState.isActive && onboardingState.currentStep === 11}
        position={{ x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 }}
        onClose={() => {}}
        showCloseButton={false}
        closeOnClickOutside={false}
        initialWidth={400}
        initialHeight="auto"
        preventOverflow={true}
      >
        <div className="text-center p-8" data-step-11-popover>
          <StepCounter currentStep={11} totalSteps={11} className="mb-6" />
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-library-gold-100 to-library-gold-200 rounded-full flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-serif font-semibold text-reading-primary mb-4">
            You're All Set!
          </h3>
          <p className="text-reading-secondary text-base mb-6 leading-relaxed">
            You've learned how to navigate blocks, create conversations, and explore different view modes. Happy reading and researching!
          </p>
          <button 
            onClick={onboarding.markOnboardingComplete}
            className="inline-flex items-center gap-2 px-8 py-4 bg-library-mahogany-500 hover:bg-library-mahogany-600 text-white font-semibold rounded-book transition-all duration-300 shadow-book hover:shadow-shelf text-lg"
          >
            Start Reading!
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </BasePopover>
    </>
  );
}