"use client";

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDocumentUploadV2 } from '@/hooks/useDocumentUploadV2';
import { useProcessing } from '@/contexts/ProcessingContext';

interface UploadButtonProps {
  onUploadComplete?: () => void;
}

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);
  const [showUploadStarted, setShowUploadStarted] = useState(false);

  const { isUploading, uploadError, uploadFile, uploadFromUrl } = useDocumentUploadV2();
  const { openProcessingModal } = useProcessing();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('[UploadButton] Starting file upload:', file.name);
      
      // Show immediate feedback
      setShowUploadStarted(true);
      
      const documentId = await uploadFile(file);
      console.log('[UploadButton] Upload returned documentId:', documentId);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (documentId) {
        // Close upload modal and show processing modal
        console.log('[UploadButton] Closing upload modal and opening processing modal');
        setIsOpen(false);
        setTimeout(() => {
          console.log('[UploadButton] Calling openProcessingModal with:', documentId);
          openProcessingModal(documentId);
          setShowUploadStarted(false);
        }, 300);
        onUploadComplete?.();
      } else {
        // Reset on error
        setShowUploadStarted(false);
      }
    }
  };

  const handleUrlUpload = async () => {
    if (urlInput.trim()) {
      // Show immediate feedback
      setShowUploadStarted(true);
      
      // Pass the user's URL to the augment service
      const augmentUrl = `https://augment.explainai.pro/generate-pdf?url=${encodeURIComponent(urlInput)}`;
      const filename = `generated-${Date.now()}.pdf`;
      const documentId = await uploadFromUrl(augmentUrl, filename);
      setUrlInput('');
      if (documentId) {
        // Close upload modal and show processing modal
        setIsOpen(false);
        setTimeout(() => {
          openProcessingModal(documentId);
          setShowUploadStarted(false);
        }, 300);
        onUploadComplete?.();
      } else {
        // Reset on error
        setShowUploadStarted(false);
      }
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev + 1);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter(prev => prev - 1);
    if (dragCounter - 1 === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setDragCounter(0);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // Validate that it's a PDF
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Show immediate feedback
        setShowUploadStarted(true);
        
        const documentId = await uploadFile(file);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        
        if (documentId) {
          // Close upload modal and show processing modal
          setIsOpen(false);
          setTimeout(() => {
            openProcessingModal(documentId);
            setShowUploadStarted(false);
          }, 300);
          onUploadComplete?.();
        } else {
          // Reset on error
          setShowUploadStarted(false);
        }
      } else {
        // Show error for non-PDF files
        alert('Please upload a PDF file only');
      }
      
      e.dataTransfer.clearData();
    }
  };



  return (
    <>
      <motion.button
        onClick={() => {
          setIsOpen(true);
          setShowUploadStarted(false);
        }}
        className="inline-flex items-center px-3 py-1.5 bg-library-mahogany-500 text-white text-lg font-medium rounded-md shadow-sm hover:bg-library-mahogany-600 transition-colors whitespace-nowrap"
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
              onClick={() => !isUploading && setIsOpen(false)}
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
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 transition-all duration-300 relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Upload Started Overlay */}
              <AnimatePresence>
                {(showUploadStarted || isUploading) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white bg-opacity-95 z-10 flex flex-col items-center justify-center"
                  >
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="text-center"
                    >
                      <div className="mb-4">
                        <svg
                          className="w-20 h-20 mx-auto text-library-mahogany-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Upload Started!</h3>
                      <p className="text-gray-600">Your document is being processed...</p>
                      <div className="mt-6 flex justify-center">
                        <div className="w-8 h-8 border-4 border-library-mahogany-200 border-t-library-mahogany-600 rounded-full animate-spin" />
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Upload Document
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={showUploadStarted || isUploading}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>


              {/* Upload Area */}
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
                        disabled={isUploading}
                      />
                      <div
                        onClick={() => !isUploading && fileInputRef.current?.click()}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                          isDragging 
                            ? 'border-library-mahogany-500 bg-library-mahogany-50' 
                            : 'border-gray-300 hover:border-library-mahogany-400 hover:bg-gray-50'
                        }`}
                      >
                        {isDragging && (
                          <div className="absolute inset-0 flex items-center justify-center bg-library-mahogany-50 bg-opacity-90 rounded-xl">
                            <div className="text-center">
                              <svg
                                className="mx-auto h-16 w-16 text-library-mahogany-500 animate-pulse"
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
                              <p className="mt-3 text-xl font-semibold text-library-mahogany-600">
                                Drop your PDF here
                              </p>
                              <p className="text-base text-library-mahogany-500">
                                Release to upload
                              </p>
                            </div>
                          </div>
                        )}
                        <svg
                          className={`mx-auto h-12 w-12 ${isDragging ? 'text-transparent' : 'text-gray-400'}`}
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
                        <p className={`mt-2 text-lg ${isDragging ? 'text-transparent' : 'text-gray-600'}`}>
                          Click to upload or drag and drop
                        </p>
                        <p className={`text-base ${isDragging ? 'text-transparent' : 'text-gray-500'}`}>PDF files only</p>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="url-input" className="block text-lg font-medium text-gray-700 mb-2">
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
                          disabled={!urlInput.trim() || isUploading}
                          className="w-full py-3 px-4 bg-library-mahogany-500 text-white rounded-lg font-medium hover:bg-library-mahogany-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Generate
                        </button>
                        <div className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-100 border border-blue-300">
                          <span className="text-lg font-semibold text-blue-700">
                            BETA FEATURE
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              
              {/* Error display */}
              {uploadError && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm text-red-700">{uploadError}</p>
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