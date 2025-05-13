import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
      className="space-y-6 w-full max-w-md mx-auto"
    >
      {/* Previously Uploaded Documents with refined styling */}
      <div>
        <h2 className="text-xl font-serif font-medium mb-4 text-ink-700">Previously Uploaded Documents</h2>
        <DocumentSelector onSelectDocument={handleSelectDocument} />
      </div>

      {/* Upload Button and Progress Area with elegant styling */}
      <div className="relative flex flex-col items-center mt-8">
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
          disabled={isProcessing}
        />
        
        {/* Upload button */}
        <motion.button
          onClick={() => fileInputRef.current?.click()}
          className={`
            px-10 py-3 rounded-md
            bg-paper-50 text-ink-800 border border-paper-300
            shadow-paper hover:shadow-paper-hover
            transition-all duration-300
            flex items-center gap-2 group
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          whileHover={{ scale: isProcessing ? 1 : 1.02 }}
          whileTap={{ scale: isProcessing ? 1 : 0.98 }}
          disabled={isProcessing}
        >
          {/* Upload arrow icon */}
          <svg
            className="w-5 h-5 transition-transform duration-300 text-ink-700"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              d="M12 16V4M12 4L7 9M12 4L17 9M4 20H20" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          
          <span className="font-serif text-lg">
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
