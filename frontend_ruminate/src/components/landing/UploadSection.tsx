import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      className="space-y-12 w-full mx-auto"
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
      <div className="mb-10">
        <h2 className="text-2xl font-serif font-medium mb-6 text-ink-800">Previously Uploaded Documents</h2>
        <DocumentSelector onSelectDocument={handleSelectDocument} />
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
        
        {/* Elegant paper-like button to match illustration */}
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          className={`
            px-10 py-5 rounded-md
            bg-paper-100 text-ink-800 border border-paper-400
            shadow-paper
            transition-all duration-300
            flex items-center gap-4 group
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          whileHover={{ scale: isProcessing ? 1 : 1.03 }}
          whileTap={{ scale: isProcessing ? 1 : 0.98 }}
          disabled={isProcessing}
        >
          {/* Upload icon */}
          <svg
            className="w-7 h-7 text-ink-700"
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
          
          <span className="font-serif text-xl">
            {isProcessing ? "Processing..." : "Upload PDF"}
          </span>
        </motion.button>

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
