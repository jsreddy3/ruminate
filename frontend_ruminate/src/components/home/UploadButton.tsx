"use client";

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import UploadProgressSteps from './UploadProgressSteps';

interface UploadButtonProps {
  onUploadComplete?: () => void;
}

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');

  const {
    isProcessing,
    error,
    documentId,
    pdfFile,
    uploadFile,
    uploadFromUrl,
    hasUploadedFile,
    processingEvents,
    currentStatus,
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

  const handleUrlUpload = async () => {
    if (urlInput.trim()) {
      // Pass the user's URL to the augment service
      const augmentUrl = `https://augment.explainai.pro/generate-pdf?url=${encodeURIComponent(urlInput)}`;
      const filename = `generated-${Date.now()}.pdf`;
      await uploadFromUrl(augmentUrl, filename);
      setUrlInput('');
    }
  };

  // Navigate to viewer when upload is complete
  useEffect(() => {
    if (hasUploadedFile && documentId) {
      // Close modal first
      setIsOpen(false);
      // Reset upload mode
      setUploadMode('file');
      // Navigate to viewer
      router.push(`/viewer/${documentId}`);
      // Call callback if provided
      onUploadComplete?.();
    }
  }, [hasUploadedFile, documentId, router, onUploadComplete]);


  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-3 py-1.5 bg-library-mahogany-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-library-mahogany-600 transition-colors whitespace-nowrap"
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
                className={`bg-white rounded-xl shadow-2xl w-full p-6 transition-all duration-300 ${
                  isProcessing ? 'max-w-4xl' : 'max-w-md'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  {isProcessing ? 'Processing Your Document' : 'Upload Document'}
                </h2>
                {!isProcessing && (
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>


              {/* Upload Area or Progress */}
              {!isProcessing ? (
                <div className="mb-6">
                  {/* Upload mode toggle */}
                  <div className="flex space-x-2 mb-4">
                    <button
                      onClick={() => setUploadMode('file')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        uploadMode === 'file'
                          ? 'bg-library-mahogany-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Upload PDF
                    </button>
                    <button
                      onClick={() => setUploadMode('url')}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                        uploadMode === 'url'
                          ? 'bg-library-mahogany-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Generate from URL
                    </button>
                  </div>

                  {uploadMode === 'file' ? (
                    <>
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
                        className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer transition-all hover:border-library-mahogany-400 hover:bg-gray-50"
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
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PDF files only</p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-2">
                          Enter URL to convert
                        </label>
                        <input
                          id="url-input"
                          type="url"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="https://example.com/article"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-library-mahogany-500 focus:border-library-mahogany-500 text-gray-900 placeholder-gray-400 bg-white"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && urlInput.trim()) {
                              handleUrlUpload();
                            }
                          }}
                        />
                      </div>
                      <div className="flex flex-col items-center space-y-3">
                        <button
                          onClick={handleUrlUpload}
                          disabled={!urlInput.trim()}
                          className="w-full py-3 px-4 bg-library-mahogany-500 text-white rounded-lg font-medium hover:bg-library-mahogany-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Generate
                        </button>
                        <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-100 border border-blue-300">
                          <span className="text-sm font-semibold text-blue-700">
                            BETA FEATURE
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-6">
                  <UploadProgressSteps 
                    events={processingEvents}
                    currentStatus={currentStatus}
                    error={error || undefined}
                    isUrlUpload={uploadMode === 'url'}
                  />
                </div>
              )}

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}