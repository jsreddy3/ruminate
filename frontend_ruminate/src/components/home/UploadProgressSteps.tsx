"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { DocumentProcessingEvent, DocumentStatus } from '@/types';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';

interface UploadProgressStepsProps {
  events: DocumentProcessingEvent[];
  currentStatus: DocumentStatus;
  error?: string;
}

interface StepInfo {
  id: string;
  title: string;
  description: string;
  icon: string;
  estimatedTime?: string;
}

const PROCESSING_STEPS: StepInfo[] = [
  {
    id: 'UPLOADING',
    title: 'Uploading Document',
    description: 'Securely transferring your PDF to our servers',
    icon: '📤',
    estimatedTime: '5-10 seconds'
  },
  {
    id: 'PROCESSING_MARKER',
    title: 'Extracting Content',
    description: 'Using AI to parse text, images, and structure from your PDF',
    icon: '🔍',
    estimatedTime: '30-60 seconds'
  },
  {
    id: 'ANALYZING_CONTENT',
    title: 'Generating Summary',
    description: 'Creating an intelligent overview of your document',
    icon: '🧠',
    estimatedTime: '15-30 seconds'
  },
  {
    id: 'READY',
    title: 'Ready to Explore!',
    description: 'Your document is processed and ready for analysis',
    icon: '✨',
  }
];

const getStepStatus = (stepId: string, currentStatus: DocumentStatus, _events: DocumentProcessingEvent[]) => {
  const stepIndex = PROCESSING_STEPS.findIndex(step => step.id === stepId);
  const currentIndex = PROCESSING_STEPS.findIndex(step => step.id === currentStatus);
  
  if (currentStatus === 'ERROR') {
    return stepIndex < currentIndex ? 'completed' : 'error';
  }
  
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
};

const StepIcon = ({ step, status }: { step: StepInfo; status: string }) => {
  if (status === 'completed') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
      >
        <CheckIcon className="w-5 h-5 text-white" />
      </motion.div>
    );
  }
  
  if (status === 'error') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"
      >
        <ExclamationTriangleIcon className="w-5 h-5 text-white" />
      </motion.div>
    );
  }
  
  if (status === 'active') {
    return (
      <motion.div
        className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg"
        animate={{ 
          scale: [1, 1.1, 1],
          boxShadow: [
            '0 0 0 0 rgba(59, 130, 246, 0.7)',
            '0 0 0 10px rgba(59, 130, 246, 0)',
            '0 0 0 0 rgba(59, 130, 246, 0)'
          ]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {step.icon}
      </motion.div>
    );
  }
  
  return (
    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 text-lg">
      {step.icon}
    </div>
  );
};

const ProgressConnector = ({ isCompleted, isActive }: { isCompleted: boolean; isActive: boolean }) => (
  <div className="flex-1 mx-4">
    <div className="h-0.5 bg-gray-200 relative overflow-hidden rounded">
      <motion.div
        className={`h-full ${isCompleted ? 'bg-green-500' : isActive ? 'bg-blue-500' : 'bg-gray-200'}`}
        initial={{ width: '0%' }}
        animate={{ width: isCompleted ? '100%' : isActive ? '50%' : '0%' }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
      />
      {isActive && (
        <motion.div
          className="absolute top-0 h-full w-8 bg-gradient-to-r from-transparent via-white to-transparent opacity-60"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  </div>
);

const ProcessingMessages = ({ events, currentStatus }: { events: DocumentProcessingEvent[]; currentStatus: DocumentStatus }) => {
  const latestEvent = events[events.length - 1];
  
  const getDisplayMessage = () => {
    switch (currentStatus) {
      case 'UPLOADING':
        return "Uploading your document...";
      case 'PROCESSING_MARKER':
        return "Our AI is carefully reading through your document...";
      case 'ANALYZING_CONTENT':
        return "Creating a smart summary of your content...";
      case 'ANALYSIS_COMPLETE':
        return "Almost ready! Finalizing everything...";
      case 'READY':
        return "🎉 Your document is ready to explore!";
      case 'ERROR':
        return latestEvent?.error || "Something went wrong. Please try again.";
      default:
        return "Processing your document...";
    }
  };

  const getSubMessage = () => {
    const currentStep = PROCESSING_STEPS.find(step => step.id === currentStatus);
    if (currentStep?.estimatedTime && currentStatus !== 'READY' && currentStatus !== 'ERROR') {
      return `Estimated time: ${currentStep.estimatedTime}`;
    }
    return null;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentStatus}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="text-center mt-6"
      >
        <p className={`text-lg font-medium ${currentStatus === 'ERROR' ? 'text-red-600' : 'text-gray-700'}`}>
          {getDisplayMessage()}
        </p>
        {getSubMessage() && (
          <p className="text-sm text-gray-500 mt-1">
            {getSubMessage()}
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default function UploadProgressSteps({ events, currentStatus, error: _error }: UploadProgressStepsProps) {
  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {PROCESSING_STEPS.map((step, index) => {
          const status = getStepStatus(step.id, currentStatus, events);
          const isLast = index === PROCESSING_STEPS.length - 1;
          
          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <StepIcon step={step} status={status} />
                <div className="mt-2 text-center">
                  <p className={`text-xs font-medium ${
                    status === 'completed' ? 'text-green-600' : 
                    status === 'active' ? 'text-blue-600' : 
                    status === 'error' ? 'text-red-600' :
                    'text-gray-400'
                  }`}>
                    {step.title}
                  </p>
                </div>
              </div>
              {!isLast && (
                <ProgressConnector 
                  isCompleted={status === 'completed'} 
                  isActive={status === 'active'} 
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Processing Messages */}
      <ProcessingMessages events={events} currentStatus={currentStatus} />

      {/* Fun Facts while waiting */}
      {(currentStatus === 'PROCESSING_MARKER' || currentStatus === 'ANALYZING_CONTENT') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-100"
        >
          <p className="text-sm text-blue-700 text-center">
            💡 <strong>Did you know?</strong> Our AI reads your document alongside you -- it's the perfect copilot!
          </p>
        </motion.div>
      )}
    </div>
  );
}