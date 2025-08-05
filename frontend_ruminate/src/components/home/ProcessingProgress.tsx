"use client";

import { motion, AnimatePresence } from 'framer-motion';
import { DocumentProcessingEvent, DocumentStatus } from '@/types';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { 
  DocumentIcon, 
  CloudArrowUpIcon, 
  DocumentMagnifyingGlassIcon,
  SparklesIcon,
  GlobeAltIcon,
  DocumentArrowUpIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';

interface ProcessingProgressProps {
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
}

const URL_PROCESSING_STEPS: StepInfo[] = [
  {
    id: 'pdf_navigating',
    title: 'Navigating',
    description: 'Opening webpage',
    icon: <GlobeAltIcon className="w-5 h-5" />
  },
  {
    id: 'pdf_generating',
    title: 'Generating PDF',
    description: 'Converting to document',
    icon: <DocumentIcon className="w-5 h-5" />
  },
  {
    id: 'pdf_uploading',
    title: 'Uploading',
    description: 'Transferring file',
    icon: <CloudArrowUpIcon className="w-5 h-5" />
  },
  {
    id: 'PROCESSING_MARKER',
    title: 'Reading',
    description: 'Extracting content',
    icon: <DocumentMagnifyingGlassIcon className="w-5 h-5" />
  },
  {
    id: 'ANALYZING_CONTENT',
    title: 'Analyzing',
    description: 'Creating summary',
    icon: <CpuChipIcon className="w-5 h-5" />
  },
  {
    id: 'READY',
    title: 'Complete',
    description: 'Ready to explore',
    icon: <SparklesIcon className="w-5 h-5" />
  }
];

const FILE_PROCESSING_STEPS: StepInfo[] = [
  {
    id: 'UPLOADING',
    title: 'Uploading',
    description: 'Transferring document',
    icon: <DocumentArrowUpIcon className="w-5 h-5" />
  },
  {
    id: 'PROCESSING_MARKER',
    title: 'Reading',
    description: 'Extracting content',
    icon: <DocumentMagnifyingGlassIcon className="w-5 h-5" />
  },
  {
    id: 'ANALYZING_CONTENT',
    title: 'Analyzing',
    description: 'Creating summary',
    icon: <CpuChipIcon className="w-5 h-5" />
  },
  {
    id: 'READY',
    title: 'Complete',
    description: 'Ready to explore',
    icon: <SparklesIcon className="w-5 h-5" />
  }
];

export default function ProcessingProgress({ 
  events, 
  currentStatus, 
  error,
  isUrlUpload = false 
}: ProcessingProgressProps) {
  
  // Determine if this is a URL upload based on events or prop
  const hasUrlEvents = events.some(e => e.event_type?.startsWith('pdf_'));
  const isUrl = isUrlUpload || hasUrlEvents;
  const steps = isUrl ? URL_PROCESSING_STEPS : FILE_PROCESSING_STEPS;
  
  // Get the active step index
  const getActiveStepIndex = () => {
    const latestEvent = events[events.length - 1];
    const effectiveStatus = latestEvent?.event_type?.startsWith('pdf_') ? latestEvent.event_type : currentStatus;
    
    const index = steps.findIndex(step => step.id === effectiveStatus);
    return index >= 0 ? index : 0;
  };
  
  const activeIndex = getActiveStepIndex();
  const progress = ((activeIndex + 1) / steps.length) * 100;
  
  // Get current message from events
  const getCurrentMessage = () => {
    const latestEvent = events[events.length - 1];
    if (error) return error;
    if (latestEvent?.message) return latestEvent.message;
    return steps[activeIndex]?.description || 'Processing...';
  };

  return (
    <div className="w-full">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => {
            const isActive = index === activeIndex;
            const isComplete = index < activeIndex;
            const isError = currentStatus === 'ERROR' && index === activeIndex;
            
            return (
              <div key={step.id} className="flex-1 flex items-center">
                <div className="flex flex-col items-center">
                  {/* Step Circle */}
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isActive ? 1.1 : 1,
                    }}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center
                      transition-all duration-300
                      ${isComplete ? 'bg-library-forest-500 text-white' :
                        isActive ? 'bg-library-mahogany-500 text-white' :
                        isError ? 'bg-red-500 text-white' :
                        'bg-library-cream-200 text-library-sage-600'}
                    `}
                  >
                    {isComplete ? (
                      <CheckIcon className="w-5 h-5" />
                    ) : isError ? (
                      <XMarkIcon className="w-5 h-5" />
                    ) : (
                      <div className={isActive ? 'animate-pulse' : ''}>
                        {step.icon}
                      </div>
                    )}
                  </motion.div>
                  
                  {/* Step Label */}
                  <div className="mt-2 text-center">
                    <p className={`
                      text-xs font-medium
                      ${isComplete ? 'text-library-forest-700' :
                        isActive ? 'text-library-mahogany-700' :
                        isError ? 'text-red-700' :
                        'text-library-sage-500'}
                    `}>
                      {step.title}
                    </p>
                  </div>
                </div>
                
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 h-0.5 mx-2 -mt-5">
                    <div className="h-full bg-library-cream-300 relative overflow-hidden">
                      <motion.div
                        initial={{ width: '0%' }}
                        animate={{ 
                          width: isComplete ? '100%' : isActive ? '50%' : '0%' 
                        }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-library-forest-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="h-2 bg-library-cream-200 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={`h-full ${
              currentStatus === 'ERROR' ? 'bg-red-500' :
              currentStatus === 'READY' ? 'bg-library-forest-500' :
              'bg-library-mahogany-500'
            }`}
          />
        </div>
      </div>
      
      {/* Status Message */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStatus}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-center"
        >
          <p className={`
            text-lg font-serif
            ${currentStatus === 'ERROR' ? 'text-red-700' :
              currentStatus === 'READY' ? 'text-library-forest-700' :
              'text-library-mahogany-700'}
          `}>
            {getCurrentMessage()}
          </p>
          
          {/* Detailed status for active step */}
          {activeIndex >= 0 && currentStatus !== 'ERROR' && currentStatus !== 'READY' && (
            <p className="text-sm text-library-sage-600 mt-1">
              Step {activeIndex + 1} of {steps.length}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}