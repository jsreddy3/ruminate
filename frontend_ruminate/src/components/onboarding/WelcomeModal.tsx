"use client";

import React from 'react';
import { BookOpen, ArrowRight } from 'lucide-react';
import BaseModal from '../common/BaseModal';
import { useOnboarding } from '@/contexts/OnboardingContext';

interface WelcomeModalProps {
  onStartTour: () => void;
}

export default function WelcomeModal({ onStartTour }: WelcomeModalProps) {
  const { state, closeWelcomeModal, markWelcomeComplete, startOnboarding, setStep } = useOnboarding();

  const handleStartTour = () => {
    closeWelcomeModal();
    startOnboarding();
    setStep(2); // Jump directly to library tour step
    onStartTour();
  };

  const handleSkip = () => {
    markWelcomeComplete();
  };

  return (
    <BaseModal
      isVisible={state.isWelcomeModalOpen}
      onClose={closeWelcomeModal}
      maxWidth="max-w-md"
      showCloseButton={false}
      closeOnClickOutside={false}
      closeOnEscape={false}
      className="bg-surface-parchment border border-library-cream-300 shadow-book rounded-journal"
      backdropClassName="bg-black bg-opacity-50"
    >
      <div className="p-6">
        <div className="text-center">
          <BookOpen className="w-8 h-8 text-library-mahogany-600 mx-auto mb-4" />
          
          <h2 className="text-2xl font-serif font-semibold text-reading-primary mb-2">
            Welcome to Ruminate
          </h2>
          
          <p className="text-reading-muted mb-6">
            Your first document is waiting...
          </p>
          
          <div className="space-y-3">
            <button
              onClick={handleStartTour}
              className="w-full px-6 py-3 text-white bg-library-mahogany-600 hover:bg-library-mahogany-700 rounded-lg transition-colors inline-flex items-center justify-center font-serif font-medium"
              style={{ backgroundColor: '#9e5632' }}
            >
              <span>Click here to begin</span>
              <ArrowRight className="ml-2 w-4 h-4" />
            </button>
            <button
              onClick={handleSkip}
              className="text-reading-muted hover:text-reading-secondary transition-colors text-xs underline"
            >
              Skip introduction
            </button>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}