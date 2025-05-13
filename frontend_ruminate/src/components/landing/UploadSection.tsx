import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import ObjectiveSelector from '../viewer/ObjectiveSelector';
import DocumentSelector from '../viewer/DocumentSelector';
import UploadProgressIndicator from './UploadProgressIndicator';
import { ProcessingProgress } from '@/types';

interface UploadSectionProps {
  currentObjective: string;
  setCurrentObjective: (objective: string) => void;
  isProcessing: boolean;
  progress: ProcessingProgress | null;
  error: string | null;
  uploadFile: (file: File) => Promise<void>;
  handleSelectDocument: (documentId: string, pdfUrl: string) => Promise<void>;
  showObjectiveSelector?: boolean;
}

export default function UploadSection({
  currentObjective,
  setCurrentObjective,
  isProcessing,
  progress,
  error,
  uploadFile,
  handleSelectDocument,
  showObjectiveSelector = true
}: UploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [uploadFile]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="space-y-12 w-full mx-auto text-center"
    >
      {/* Objective Selector with elegant styling - only show if requested */}
      {showObjectiveSelector && (
        <div className="text-center flex flex-col items-center w-full">
          <label className="block text-sm uppercase tracking-wide font-medium text-ink-600 mb-3">
            Rumination Objective
          </label>
          <div className="flex justify-center w-full">
            <ObjectiveSelector onObjectiveChange={setCurrentObjective} />
          </div>
        </div>
      )}

      {/* Previously Uploaded Documents with refined styling */}
      <div className="mb-10 relative">
        <h2 className="text-2xl font-serif font-medium mb-6 text-ink-800">Previously Uploaded Documents</h2>
        
        {/* Outer document section container with background image */}
        <div className="relative">
          <div className="relative z-0">
            <Image 
              src="/outer_uploads_component.png" 
              alt="" 
              width={600} 
              height={200}
              className="w-full h-auto object-contain"
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-6 z-10">
            <DocumentSelector onSelectDocument={handleSelectDocument} />
          </div>
        </div>
      </div>

      {/* Upload Button and Progress Area with elegant styling */}
      <div className="relative flex flex-col items-center gap-8 mt-8">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
          disabled={isProcessing}
        />
        
        {/* Elegant paper-like button with custom background image */}
        <div className="relative">
          <motion.button
            onClick={() => fileInputRef.current?.click()}
            className={`
              px-10 py-5 
              flex items-center gap-4 relative z-10
              ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            `}
            whileHover={{ scale: isProcessing ? 1 : 1.03 }}
            whileTap={{ scale: isProcessing ? 1 : 0.98 }}
            disabled={isProcessing}
          >
            <div className="absolute inset-0 z-0">
              <Image 
                src="/upload_button_cropped.png" 
                alt="" 
                width={400} 
                height={120}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-3 z-10 relative">
              <svg
                className="w-6 h-6 text-ink-800"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 15V3m0 0L6 9m6-6l6 6" />
                <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" />
              </svg>
              
              <span className="font-serif text-xl font-medium text-ink-800">
                {isProcessing ? "Processing..." : "Upload PDF"}
              </span>
            </div>
          </motion.button>
        </div>

        {/* Progress Indicator Area */}
        <AnimatePresence>
          {isProcessing && (
            <UploadProgressIndicator progress={progress} />
          )}
        </AnimatePresence>

        {/* Error Display */}
        <AnimatePresence>
          {error && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-terracotta-700 text-base mt-4 font-serif italic"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
