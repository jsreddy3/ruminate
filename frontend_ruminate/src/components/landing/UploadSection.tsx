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
      className="space-y-10 w-full max-w-md mx-auto"
    >
      {/* Objective Selector with elegant styling */}
      <div className="text-center flex flex-col items-center w-full">
        <label className="block text-sm uppercase tracking-wide font-medium text-ink-600 mb-3">
          Rumination Objective
        </label>
        <div className="flex justify-center w-full">
          <ObjectiveSelector onObjectiveChange={setCurrentObjective} />
        </div>
      </div>

      {/* Previously Uploaded Documents with refined styling */}
      <div className="mb-8">
        <h2 className="text-xl font-serif font-medium mb-4 text-ink-700">Previously Uploaded Documents</h2>
        <DocumentSelector onSelectDocument={handleSelectDocument} />
      </div>

      {/* Upload Button and Progress Area with elegant styling */}
      <div className="relative flex flex-col items-center gap-4">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
          disabled={isProcessing}
        />
        
        {/* Elegant paper-like button */}
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          className={`
            px-8 py-4 rounded-md
            bg-paper-100 text-ink-800 border border-paper-300
            shadow-paper hover:shadow-paper-hover
            transition-all duration-300
            flex items-center gap-3 group
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          whileHover={{ scale: isProcessing ? 1 : 1.02 }}
          whileTap={{ scale: isProcessing ? 1 : 0.98 }}
          disabled={isProcessing}
        >
          {/* SVG Icon - use custom SVG icon */}
          <svg
            className="w-6 h-6 transition-transform duration-300 group-hover:rotate-6 text-ink-700"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M12 4V16M12 4L8 8M12 4L16 8M6 16V18C6 18.5304 6.21071 19.0391 6.58579 19.4142C6.96086 19.7893 7.46957 20 8 20H16C16.5304 20 17.0391 19.7893 17.4142 19.4142C17.7893 19.0391 18 18.5304 18 18V16" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="group-hover:animate-handDraw"
            />
          </svg>
          
          <span className="font-serif text-lg">
            {isProcessing ? "Processing..." : "Upload PDF"}
          </span>
        </motion.button>

        {/* Decorative lines */}
        <motion.div 
          className="absolute -z-10 -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-px bg-paper-400"
          initial={{ width: 0 }}
          animate={{ width: 128 }}
          transition={{ duration: 1, delay: 0.5 }}
        />
        <motion.div 
          className="absolute -z-10 -bottom-8 left-1/2 transform -translate-x-1/2 w-24 h-px bg-paper-300"
          initial={{ width: 0 }}
          animate={{ width: 96 }}
          transition={{ duration: 1, delay: 0.7 }}
        />

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
              className="text-terracotta-600 text-sm mt-2 font-medium"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
