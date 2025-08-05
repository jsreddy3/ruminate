"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { DocumentProcessingEvent, DocumentStatus } from '@/types';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/20/solid';
import ScholarlyProgressBar from '../common/ScholarlyProgressBar';
import { Globe, FileText, Upload, Search, Brain, Sparkles, Lightbulb, PartyPopper } from 'lucide-react';

interface UploadProgressStepsProps {
  events: DocumentProcessingEvent[];
  currentStatus: DocumentStatus;
  error?: string;
  isUrlUpload?: boolean;
}

interface StepInfo {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  estimatedTime?: string;
}

const URL_PROCESSING_STEPS: StepInfo[] = [
  {
    id: 'pdf_navigating',
    title: 'Navigating',
    description: 'Opening the webpage',
    icon: <Globe className="w-4 h-4" />,
    estimatedTime: '5-10 seconds'
  },
  {
    id: 'pdf_generating',
    title: 'Generating PDF',
    description: 'Converting webpage to PDF format',
    icon: <FileText className="w-4 h-4" />,
    estimatedTime: '30-45 seconds'
  },
  {
    id: 'pdf_uploading',
    title: 'Uploading',
    description: 'Transferring generated PDF',
    icon: <Upload className="w-4 h-4" />,
    estimatedTime: '5-10 seconds'
  },
  {
    id: 'PROCESSING_MARKER',
    title: 'Extracting Content',
    description: 'Using AI to parse text and structure',
    icon: <Search className="w-4 h-4" />,
    estimatedTime: '30-60 seconds'
  },
  {
    id: 'ANALYZING_CONTENT',
    title: 'Creating Summary',
    description: 'Generating intelligent overview',
    icon: <Brain className="w-4 h-4" />,
    estimatedTime: '15-30 seconds'
  },
  {
    id: 'READY',
    title: 'Ready!',
    description: 'Your document is ready',
    icon: <Sparkles className="w-4 h-4" />,
  }
];

const FILE_PROCESSING_STEPS: StepInfo[] = [
  {
    id: 'UPLOADING',
    title: 'Uploading Document',
    description: 'Securely transferring your PDF to our servers',
    icon: <Upload className="w-4 h-4" />,
    estimatedTime: '5-10 seconds'
  },
  {
    id: 'PROCESSING_MARKER',
    title: 'Extracting Content',
    description: 'Using AI to parse text, images, and structure from your PDF',
    icon: <Search className="w-4 h-4" />,
    estimatedTime: '30-60 seconds'
  },
  {
    id: 'ANALYZING_CONTENT',
    title: 'Generating Summary',
    description: 'Creating an intelligent overview of your document',
    icon: <Brain className="w-4 h-4" />,
    estimatedTime: '15-30 seconds'
  },
  {
    id: 'READY',
    title: 'Ready to Explore!',
    description: 'Your document is processed and ready for analysis',
    icon: <Sparkles className="w-4 h-4" />,
  }
];

const getStepStatus = (stepId: string, currentStatus: DocumentStatus, events: DocumentProcessingEvent[], steps: StepInfo[]) => {
  // For URL uploads, check if we have pdf_ events
  const latestEvent = events[events.length - 1];
  const effectiveStatus = latestEvent?.event_type?.startsWith('pdf_') ? latestEvent.event_type : currentStatus;
  
  const stepIndex = steps.findIndex(step => step.id === stepId);
  const currentIndex = steps.findIndex(step => step.id === effectiveStatus);
  
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
    // Check for custom PDF generation events first
    if (latestEvent?.event_type) {
      switch (latestEvent.event_type) {
        case 'pdf_navigating':
          return "Navigating to the webpage...";
        case 'pdf_generating':
          return "Generating PDF from the webpage...";
        case 'pdf_uploading':
          return "Uploading generated PDF...";
        case 'pdf_complete':
          return "PDF generation complete! Starting processing...";
      }
    }
    
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
        return "Your document is ready to explore!";
      case 'ERROR':
        return latestEvent?.error || "Something went wrong. Please try again.";
      default:
        return latestEvent?.message || "Processing your document...";
    }
  };

  const getSubMessage = () => {
    // Special handling for PDF generation
    if (latestEvent?.event_type?.startsWith('pdf_')) {
      const urlStep = URL_PROCESSING_STEPS.find(step => step.id === latestEvent.event_type);
      if (urlStep?.estimatedTime) {
        return `Estimated time: ${urlStep.estimatedTime}`;
      }
      return "This may take up to a minute...";
    }
    
    // Try both step arrays to find the current step
    const currentStep = [...FILE_PROCESSING_STEPS, ...URL_PROCESSING_STEPS].find(step => step.id === currentStatus);
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

export default function UploadProgressSteps({ events, currentStatus, error: _error, isUrlUpload = false }: UploadProgressStepsProps) {
  // Determine if this is a URL upload based on events or prop
  const hasUrlEvents = events.some(e => e.event_type?.startsWith('pdf_'));
  const isUrl = isUrlUpload || hasUrlEvents;
  const steps = isUrl ? URL_PROCESSING_STEPS : FILE_PROCESSING_STEPS;
  
  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, currentStatus, events, steps);
          const isLast = index === steps.length - 1;
          
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

      {/* Beautiful overall progress indicator */}
      {currentStatus !== 'READY' && currentStatus !== 'ERROR' && (
        <div className="mb-8 flex justify-center">
          <ScholarlyProgressBar
            progress={Math.round(((steps.findIndex(step => getStepStatus(step.id, currentStatus, events, steps) === 'active') + 1) / steps.length) * 100)}
            label="Document Processing"
            variant="processing"
            size="md"
            animated={true}
          />
        </div>
      )}

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
          <p className="text-sm text-blue-700 text-center flex items-center justify-center gap-2">
            <Lightbulb className="w-4 h-4" />
            <span><strong>Did you know?</strong> Our AI reads your document alongside you -- it's the perfect copilot!</span>
          </p>
        </motion.div>
      )}
    </div>
  );
}