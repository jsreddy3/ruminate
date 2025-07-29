"use client";

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';

interface UploadButtonProps {
  onUploadComplete?: () => void;
}

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const {
    isProcessing,
    progress,
    error,
    documentId,
    pdfFile,
    uploadFile,
    hasUploadedFile,
  } = useDocumentUpload();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Navigate to viewer when upload is complete
  if (hasUploadedFile && pdfFile && documentId) {
    router.push(`/viewer?documentId=${documentId}&pdfUrl=${encodeURIComponent(pdfFile)}`);
  }


  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary-700 transition-colors whitespace-nowrap"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <svg
          className="w-4 h-4 mr-1.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Upload
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 z-40"
              onClick={() => !isProcessing && setIsOpen(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 flex items-center justify-center z-50 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
                onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Upload Document</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>


              {/* Upload Area */}
              <div className="mb-6">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                  disabled={isProcessing}
                />
                <div
                  onClick={() => !isProcessing && fileInputRef.current?.click()}
                  className={`border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isProcessing ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary-400 hover:bg-gray-50'
                  }`}
                >
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">
                    {isProcessing ? 'Processing...' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-gray-500">PDF files only</p>
                </div>
              </div>

              {/* Progress */}
              {isProcessing && progress && (
                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">{progress.status}</div>
                  {progress.detail && (
                    <div className="text-xs text-gray-500">{progress.detail}</div>
                  )}
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((progress as any).progress || 0) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mb-4 text-sm text-red-600">{error}</div>
              )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}