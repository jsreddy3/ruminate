import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useOnboarding as useOnboardingContext } from '../../../contexts/OnboardingContext';
import { Block } from '../PDFViewer';

interface UseOnboardingProps {
  blocks: Block[];
  flattenedBlocks: Block[];
  onBlockClick?: (block: Block) => void;
  onSetStep?: (step: number) => void;
  viewMode?: string;
  closeViewDropdown?: () => void;
}

interface OnboardingEffects {
  shouldBlurHeader: boolean;
  shouldBlurToolbar: boolean;
  shouldBlurChat: boolean;
  shouldHighlightViewDropdown: boolean;
}

interface PopoverPositions {
  step4: { x: number; y: number };
  step5: { x: number; y: number };
  step6: { x: number; y: number };
  step7: { x: number; y: number };
  step8: { x: number; y: number };
  step9: { x: number; y: number };
  step10: { x: number; y: number };
  step11: { x: number; y: number };
}

export function useOnboarding({ 
  blocks: blocksParam, 
  flattenedBlocks,
  onBlockClick,
  onSetStep,
  viewMode,
  closeViewDropdown
}: UseOnboardingProps) {
  const blocks = blocksParam; // Using blocks later in effects
  // Track if interaction blocking is active
  const blockingActiveRef = useRef(false);
  const {
    state: onboardingState,
    nextStep,
    markTextSelectionComplete,
    markTooltipOptionsComplete,
    markDefineHighlightComplete,
    markChatFocusComplete,
    markViewModeComplete,
    markViewExplanationComplete,
    markOnboardingComplete,
    setStep: contextSetStep
  } = useOnboardingContext();

  // Onboarding-specific state
  const [onboardingTargetBlockId, setOnboardingTargetBlockId] = useState<string | null>(null);

  // Wrapper for setStep to use either provided or context version
  const setStep = useCallback((step: number) => {
    if (onSetStep) {
      onSetStep(step);
    } else {
      contextSetStep(step);
    }
  }, [onSetStep, contextSetStep]);

  // Global interaction blocking for steps 5-11 (excluding 9 for now)
  useEffect(() => {
    if (!onboardingState.isActive || ![5, 6, 7, 8, 10, 11].includes(onboardingState.currentStep)) {
      blockingActiveRef.current = false;
      return;
    }

    blockingActiveRef.current = true;

    const handleGlobalInteraction = (e: Event) => {
      const target = e.target as HTMLElement;
      
      if (onboardingState.currentStep === 5) {
        // Allow interaction only with the step 5 popover
        const isStep5PopoverClick = target.closest('[data-step-5-popover]');
        if (!isStep5PopoverClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (onboardingState.currentStep === 6) {
        // Allow interaction with step 6 popover AND the selection tooltip
        const isStep6PopoverClick = target.closest('[data-step-6-popover]');
        const isSelectionTooltip = target.closest('.selection-tooltip');
        // Allow any button click within the tooltip
        const isTooltipButton = isSelectionTooltip?.contains(target);
        
        if (!isStep6PopoverClick && !isSelectionTooltip && !isTooltipButton) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (onboardingState.currentStep === 7) {
        // Allow interaction only with the step 7 popover
        const isStep7PopoverClick = target.closest('[data-step-7-popover]');
        if (!isStep7PopoverClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (onboardingState.currentStep === 8) {
        // Allow interaction only with the close button and step 8 popover
        const isCloseButtonClick = target.closest('button[title*="Click here to complete the tour"]');
        const isStep8PopoverClick = target.closest('[data-step-8-popover]');
        if (!isCloseButtonClick && !isStep8PopoverClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (onboardingState.currentStep === 9) {
        // Allow interaction only with the view mode dropdown and step 9 popover
        const isViewModeDropdownClick = target.closest('[data-view-mode-dropdown]');
        const isStep9PopoverClick = target.closest('[data-step-9-popover]');
        // Also check if it's a button that contains view mode text
        const isViewButton = target.closest('button')?.textContent?.includes('View') || 
                            target.closest('button')?.textContent?.includes('PDF') ||
                            target.closest('button')?.textContent?.includes('Glossary') ||
                            target.closest('button')?.textContent?.includes('Annotations');
        
        if (!isViewModeDropdownClick && !isStep9PopoverClick && !isViewButton) {
          e.preventDefault();
          e.stopPropagation();
        }
      } else if (onboardingState.currentStep === 10) {
        // Step 10: Allow viewing but not clicking the dropdown options
        // Only allow clicks on the step 10 popover button
        const isStep10PopoverClick = target.closest('[data-step-10-popover]');
        
        // Allow hover events on dropdown but block clicks
        if (!isStep10PopoverClick) {
          if (e.type === 'click' || e.type === 'mousedown' || e.type === 'mouseup' || e.type === 'pointerdown' || e.type === 'pointerup') {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }
        }
      } else if (onboardingState.currentStep === 11) {
        // Allow interaction only with the step 11 popover
        const isStep11PopoverClick = target.closest('[data-step-11-popover]');
        if (!isStep11PopoverClick) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    // Add global event listeners with capture to block all interactions
    document.addEventListener('click', handleGlobalInteraction, true);
    document.addEventListener('mousedown', handleGlobalInteraction, true);
    document.addEventListener('keydown', handleGlobalInteraction, true);
    document.addEventListener('mouseup', handleGlobalInteraction, true);
    document.addEventListener('pointerdown', handleGlobalInteraction, true);
    document.addEventListener('pointerup', handleGlobalInteraction, true);

    return () => {
      blockingActiveRef.current = false;
      document.removeEventListener('click', handleGlobalInteraction, true);
      document.removeEventListener('mousedown', handleGlobalInteraction, true);
      document.removeEventListener('keydown', handleGlobalInteraction, true);
      document.removeEventListener('mouseup', handleGlobalInteraction, true);
      document.removeEventListener('pointerdown', handleGlobalInteraction, true);
      document.removeEventListener('pointerup', handleGlobalInteraction, true);
    };
  }, [onboardingState.isActive, onboardingState.currentStep]);

  // Set the target block for onboarding step 3
  useEffect(() => {
    if (onboardingState.isActive && onboardingState.currentStep === 3 && flattenedBlocks.length > 0) {
      // Filter to only page 1 blocks that are text (not headers or images)
      const page1Blocks = flattenedBlocks.filter(b => 
        (b.page_number === 0 || b.page_number === 1) && // Page 1 (0-indexed or 1-indexed)
        b.block_type?.toLowerCase() !== 'sectionheader' && 
        b.block_type?.toLowerCase() !== 'pageheader' &&
        b.block_type?.toLowerCase() !== 'image' &&
        b.block_type?.toLowerCase() !== 'figure'
      );
      
      // Try to find a text block with >100 words
      const getWordCount = (block: Block) => {
        const text = block.text_content || block.html_content?.replace(/<[^>]*>/g, '') || '';
        return text.split(/\s+/).filter(word => word.length > 0).length;
      };
      
      // Find first block with >100 words, or fallback to first text block
      const targetBlock = page1Blocks.find(b => getWordCount(b) > 100) || 
                          page1Blocks[0] || 
                          flattenedBlocks[0]; // Ultimate fallback
      
      if (targetBlock) {
        setOnboardingTargetBlockId(targetBlock.id);
      }
    } else if (onboardingState.currentStep !== 3) {
      setOnboardingTargetBlockId(null);
    }
  }, [onboardingState.isActive, onboardingState.currentStep, flattenedBlocks]);

  // Handle text selection during onboarding step 4
  const handleTextSelectionForOnboarding = useCallback(() => {
    if (onboardingState.isActive && onboardingState.currentStep === 4) {
      // User has successfully selected text - advance to step 5
      markTextSelectionComplete();
    }
  }, [onboardingState.isActive, onboardingState.currentStep, markTextSelectionComplete]);

  // Handle create chat action during onboarding step 6
  const handleCreateChatForOnboarding = useCallback(() => {
    if (onboardingState.isActive && onboardingState.currentStep === 6) {
      // User has successfully clicked create chat - advance immediately
      markDefineHighlightComplete();
    }
  }, [onboardingState.isActive, onboardingState.currentStep, markDefineHighlightComplete]);

  // Handle onboarding block click (step 3)
  const handleOnboardingBlockClick = useCallback((block: Block) => {
    if (onboardingState.isActive && onboardingState.currentStep === 3 && block.id === onboardingTargetBlockId) {
      // First open the block overlay as normal
      if (onBlockClick) {
        onBlockClick(block);
      }
      
      // Progress to next step immediately
      nextStep();
      setOnboardingTargetBlockId(null);
    }
  }, [onboardingState.isActive, onboardingState.currentStep, onboardingTargetBlockId, nextStep, onBlockClick]);

  // Handle view dropdown toggle during step 9
  const handleViewDropdownToggle = useCallback((e: React.MouseEvent<HTMLButtonElement>, originalHandler: (e: React.MouseEvent<HTMLButtonElement>) => void) => {
    originalHandler(e);
    
    // Advance to step 10 if we're in step 9
    if (onboardingState.isActive && onboardingState.currentStep === 9) {
      // Keep dropdown open and advance to step 10
      markViewModeComplete();
    }
  }, [onboardingState.isActive, onboardingState.currentStep, markViewModeComplete]);
  
  // Check if view dropdown should be closeable
  const canCloseViewDropdown = useCallback(() => {
    // Don't allow closing during step 10
    return !(onboardingState.isActive && onboardingState.currentStep === 10);
  }, [onboardingState.isActive, onboardingState.currentStep]);
  
  // Check if view mode option is clickable
  const canSelectViewMode = useCallback(() => {
    // Block clicks during step 10
    return !(onboardingState.isActive && onboardingState.currentStep === 10);
  }, [onboardingState.isActive, onboardingState.currentStep]);
  
  // Get view mode option class name
  const getViewModeOptionClassName = useCallback((mode: string, baseClassName: string = '') => {
    const isDisabled = onboardingState.isActive && onboardingState.currentStep === 10;
    const isActive = viewMode === mode;
    
    if (isDisabled) {
      return `${baseClassName} opacity-50 cursor-not-allowed`;
    } else if (isActive) {
      return `${baseClassName} bg-library-gold-100 text-reading-accent`;
    } else {
      return `${baseClassName} text-reading-secondary hover:bg-library-cream-100 hover:text-reading-primary`;
    }
  }, [onboardingState.isActive, onboardingState.currentStep, viewMode]);
  
  // Handle step 10 completion
  const handleStep10Complete = useCallback(() => {
    // Close the dropdown when moving to step 11
    if (closeViewDropdown) {
      closeViewDropdown();
    }
    markViewExplanationComplete();
  }, [closeViewDropdown, markViewExplanationComplete]);

  // Calculate visual effects based on onboarding step
  const effects = useMemo<OnboardingEffects>(() => {
    const isActive = onboardingState.isActive;
    const step = onboardingState.currentStep;
    
    return {
      shouldBlurHeader: isActive && ((step >= 3 && step <= 6) || step === 8),
      shouldBlurToolbar: isActive && ((step >= 3 && step <= 6) || step === 8),
      shouldBlurChat: isActive && ((step >= 3 && step <= 6) || step === 8),
      shouldHighlightViewDropdown: isActive && step === 9,
    };
  }, [onboardingState.isActive, onboardingState.currentStep]);

  // Calculate popover positions
  const popoverPositions = useMemo<PopoverPositions>(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const height = typeof window !== 'undefined' ? window.innerHeight : 1080;
    
    // Try to position step 9 near the view mode button
    // The view mode button is typically around center-left of the header
    const viewModeButtonX = width / 2 + 100; // Slightly right of center
    const headerHeight = 80; // Approximate header height
    
    return {
      step4: { x: width / 2 - 200, y: height / 2 - 120 },
      step5: { x: width / 2 - 175, y: 100 },
      step6: { x: width / 2 - 150, y: 100 },
      step7: { x: Math.min(width * 0.75, width - 200), y: height / 2 - 100 },
      step8: { x: width / 2 - 150, y: height / 2 + 50 }, // Position well below and left of the X button
      step9: { x: viewModeButtonX - 50, y: headerHeight + 80 }, // Position below the view mode button with space
      step10: { x: width / 2 - 175, y: 250 }, // Position below the dropdown
      step11: { x: width / 2 - 200, y: height / 2 - 150 },
    };
  }, []);

  // Check if a specific block should be processed for onboarding
  const shouldProcessBlockForOnboarding = useCallback((block: Block) => {
    return onboardingState.isActive && 
           onboardingState.currentStep === 3 && 
           block.id === onboardingTargetBlockId;
  }, [onboardingState.isActive, onboardingState.currentStep, onboardingTargetBlockId]);

  // Get onboarding props for BlockOverlayManager
  const getBlockOverlayManagerProps = useCallback(() => {
    return {
      onTextSelectionForOnboarding: onboardingState.isActive && onboardingState.currentStep === 4 
        ? handleTextSelectionForOnboarding 
        : undefined,
      isOnboardingStep4: onboardingState.isActive && onboardingState.currentStep === 4,
      isOnboardingStep5: onboardingState.isActive && onboardingState.currentStep === 5,
      isOnboardingStep6: onboardingState.isActive && onboardingState.currentStep === 6,
      isOnboardingStep7: onboardingState.isActive && onboardingState.currentStep === 7,
      isOnboardingStep8: onboardingState.isActive && onboardingState.currentStep === 8,
      onCreateChatForOnboarding: onboardingState.isActive && onboardingState.currentStep === 6 
        ? handleCreateChatForOnboarding 
        : undefined,
      onCompleteOnboarding: onboardingState.currentStep === 8 
        ? () => setStep(9) 
        : markOnboardingComplete,
    };
  }, [
    onboardingState.isActive, 
    onboardingState.currentStep,
    handleTextSelectionForOnboarding,
    handleCreateChatForOnboarding,
    setStep,
    markOnboardingComplete
  ]);

  // Get onboarding props for PDFBlockOverlay
  const getPDFBlockOverlayProps = useCallback(() => {
    return {
      onboardingTargetBlockId,
      isOnboardingActive: onboardingState.isActive && onboardingState.currentStep === 3,
    };
  }, [onboardingTargetBlockId, onboardingState.isActive, onboardingState.currentStep]);

  // Get class names for elements that need blur/opacity effects
  const getHeaderClassName = useCallback((baseClassName: string = '') => {
    const shouldBlur = effects.shouldBlurHeader;
    return `${baseClassName} transition-all duration-300 ${
      shouldBlur ? 'opacity-30 blur-[1px] pointer-events-none' : ''
    }`.trim();
  }, [effects.shouldBlurHeader]);

  const getToolbarClassName = useCallback((baseClassName: string = '') => {
    const shouldBlur = effects.shouldBlurToolbar;
    return `${baseClassName} transition-all duration-300 ${
      shouldBlur ? 'opacity-30 blur-[1px] pointer-events-none' : ''
    }`.trim();
  }, [effects.shouldBlurToolbar]);

  const getChatClassName = useCallback((baseClassName: string = '') => {
    const shouldBlur = effects.shouldBlurChat;
    return `${baseClassName} transition-all duration-300 ${
      shouldBlur ? 'opacity-30 blur-[1px] pointer-events-none' : ''
    }`.trim();
  }, [effects.shouldBlurChat]);

  const getViewDropdownClassName = useCallback((baseClassName: string = '') => {
    const shouldHighlight = effects.shouldHighlightViewDropdown;
    return `${baseClassName} ${
      shouldHighlight ? 'ring-4 ring-library-gold-400/70 shadow-2xl scale-110 hover:scale-115' : ''
    }`.trim();
  }, [effects.shouldHighlightViewDropdown]);

  const getViewDropdownStyle = useCallback(() => {
    const shouldHighlight = effects.shouldHighlightViewDropdown;
    return shouldHighlight ? {
      background: 'linear-gradient(135deg, #f9cf5f 0%, #edbe51 100%)',
      color: '#2c3830',
      borderColor: '#f9cf5f',
      animation: 'glow 2s ease-in-out infinite',
      boxShadow: '0 0 25px rgba(249, 207, 95, 0.9), 0 0 50px rgba(249, 207, 95, 0.5)'
    } : {
      background: 'linear-gradient(135deg, #8B4513 0%, #A0522D 100%)',
      color: '#FDF6E3',
      borderColor: '#654321'
    };
  }, [effects.shouldHighlightViewDropdown]);

  return {
    // State
    onboardingState,
    onboardingTargetBlockId,
    effects,
    popoverPositions,
    
    // Handlers
    handleTextSelectionForOnboarding,
    handleCreateChatForOnboarding,
    handleOnboardingBlockClick,
    handleViewDropdownToggle,
    canCloseViewDropdown,
    canSelectViewMode,
    getViewModeOptionClassName,
    handleStep10Complete,
    shouldProcessBlockForOnboarding,
    
    // Prop getters
    getBlockOverlayManagerProps,
    getPDFBlockOverlayProps,
    
    // Class name getters
    getHeaderClassName,
    getToolbarClassName,
    getChatClassName,
    getViewDropdownClassName,
    getViewDropdownStyle,
    
    // Actions from context
    markTooltipOptionsComplete,
    markDefineHighlightComplete,
    markChatFocusComplete,
    markViewModeComplete,
    markViewExplanationComplete,
    markOnboardingComplete,
    setStep,
  };
}