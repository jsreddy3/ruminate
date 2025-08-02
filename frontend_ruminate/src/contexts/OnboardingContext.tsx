"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface OnboardingState {
  isActive: boolean;
  currentStep: number;
  hasSeenWelcome: boolean;
  hasSeenPDFTour: boolean;
  hasSeenTextSelection: boolean;
  hasSeenDefineHighlight: boolean;
  isWelcomeModalOpen: boolean;
  showLibraryInstructions: boolean;
}

interface OnboardingContextType {
  state: OnboardingState;
  startOnboarding: () => void;
  nextStep: () => void;
  skipOnboarding: () => void;
  markWelcomeComplete: () => void;
  markTextSelectionComplete: () => void;
  markTooltipOptionsComplete: () => void;
  markDefineHighlightComplete: () => void;
  markChatFocusComplete: () => void;
  markViewModeComplete: () => void;
  markViewExplanationComplete: () => void;
  markOnboardingComplete: () => void;
  openWelcomeModal: () => void;
  closeWelcomeModal: () => void;
  setStep: (step: number) => void;
}

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const STORAGE_KEY = 'ruminate-onboarding';

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OnboardingState>({
    isActive: false,
    currentStep: 0,
    hasSeenWelcome: false,
    hasSeenPDFTour: false,
    hasSeenTextSelection: false,
    hasSeenDefineHighlight: false,
    isWelcomeModalOpen: false,
    showLibraryInstructions: false,
  });

  // Load onboarding state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsedState = JSON.parse(saved);
        setState(prev => ({
          ...prev,
          hasSeenWelcome: parsedState.hasSeenWelcome || false,
          hasSeenPDFTour: parsedState.hasSeenPDFTour || false,
          hasSeenTextSelection: parsedState.hasSeenTextSelection || false,
          hasSeenDefineHighlight: parsedState.hasSeenDefineHighlight || false,
        }));
      }
    } catch (error) {
      console.error('Failed to load onboarding state:', error);
    }
  }, []);

  // Save onboarding state to localStorage
  const saveState = (newState: Partial<OnboardingState>) => {
    try {
      const currentSaved = localStorage.getItem(STORAGE_KEY);
      const currentState = currentSaved ? JSON.parse(currentSaved) : {};
      const updatedState = { ...currentState, ...newState };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedState));
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  };

  const startOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: true,
      currentStep: 0,
    }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: prev.currentStep + 1,
    }));
  }, []);

  const skipOnboarding = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false,
      hasSeenWelcome: true,
      isWelcomeModalOpen: false,
    }));
    saveState({ hasSeenWelcome: true });
  }, []);

  const markWelcomeComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasSeenWelcome: true,
      isWelcomeModalOpen: false,
    }));
    saveState({ hasSeenWelcome: true });
  }, []);

  const markTextSelectionComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasSeenTextSelection: true,
      currentStep: 5, // Advance to new step 5 (tooltip options overview)
    }));
    saveState({ hasSeenTextSelection: true });
  }, []);

  const markTooltipOptionsComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 6, // Advance to step 6 (create chat focus)
    }));
  }, []);

  const markDefineHighlightComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      hasSeenDefineHighlight: true,
      currentStep: 7, // Advance to step 7 (chat focus)
    }));
    saveState({ hasSeenDefineHighlight: true });
  }, []);

  const markChatFocusComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 8, // Advance to step 8 (close block)
    }));
  }, []);

  const markViewModeComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 10, // Advance to step 10 (view explanation)
    }));
  }, []);

  const markViewExplanationComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: 11, // Advance to step 11 (onboarding complete)
    }));
  }, []);

  const markOnboardingComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false, // Complete onboarding
    }));
  }, []);

  const openWelcomeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isWelcomeModalOpen: true,
    }));
  }, []);

  const closeWelcomeModal = useCallback(() => {
    setState(prev => ({
      ...prev,
      isWelcomeModalOpen: false,
    }));
  }, []);

  const setStep = useCallback((step: number) => {
    setState(prev => ({
      ...prev,
      currentStep: step,
    }));
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        state,
        startOnboarding,
        nextStep,
        skipOnboarding,
        markWelcomeComplete,
        markTextSelectionComplete,
        markTooltipOptionsComplete,
        markDefineHighlightComplete,
        markChatFocusComplete,
        markViewModeComplete,
        markViewExplanationComplete,
        markOnboardingComplete,
        openWelcomeModal,
        closeWelcomeModal,
        setStep,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}