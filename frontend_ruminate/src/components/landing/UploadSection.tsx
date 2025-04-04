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
}

export default function UploadSection({
  currentObjective,
  setCurrentObjective,
  isProcessing,
  progress,
  error,
  uploadFile,
  handleSelectDocument
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
      className="space-y-8 w-full max-w-md mx-auto"
    >
      {/* Objective Selector */}
      <div className="text-center flex flex-col items-center w-full">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Rumination Objective
        </label>
        <div className="flex justify-center w-full">
          <ObjectiveSelector onObjectiveChange={setCurrentObjective} />
        </div>
      </div>

      {/* Previously Uploaded Documents */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-neutral-700">Previously Uploaded Documents</h2>
        <DocumentSelector onSelectDocument={handleSelectDocument} />
      </div>

      {/* Upload Button and Progress Area */}
      <div className="relative flex flex-col items-center gap-4">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
          disabled={isProcessing}
        />
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          className={`px-8 py-4 bg-primary-600 text-white rounded-xl shadow-lg
                    hover:bg-primary-700 hover:shadow-xl
                    transition-all duration-200
                    flex items-center gap-3 group
                    ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          whileHover={{ scale: isProcessing ? 1 : 1.02 }}
          whileTap={{ scale: isProcessing ? 1 : 0.98 }}
          disabled={isProcessing}
        >
          {/* SVG Icon */}
          <svg
            className="w-6 h-6 transition-transform duration-200 group-hover:rotate-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <span className="text-lg font-medium">
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
              className="text-red-600 text-sm mt-2"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
