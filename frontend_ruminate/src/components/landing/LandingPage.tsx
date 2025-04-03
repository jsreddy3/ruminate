"use client";

import { useState, useRef, useEffect, useCallback } from 'react'; 
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import ObjectiveSelector from '../viewer/ObjectiveSelector';
import DocumentSelector from '../viewer/DocumentSelector';
import { useDocumentUpload } from '@/hooks/useDocumentUpload'; 
import UploadProgressIndicator from './UploadProgressIndicator'; 

// Dynamically import PDFViewer
const PDFViewer = dynamic(() => import('../pdf/PDFViewer'), {
  ssr: false,
});

export default function LandingPage() {
  // State managed by the component
  const [currentObjective, setCurrentObjective] = useState("Focus on key vocabulary and jargon that a novice reader would not be familiar with.");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // State and logic managed by the custom hook
  const {
    isProcessing,
    progress,
    error,
    documentId, 
    pdfFile, 
    uploadFile, 
    resetUploadState, 
    hasUploadedFile, 
    setDocumentIdDirectly, 
    setPdfFileDirectly, 
    setHasUploadedFileDirectly 
  } = useDocumentUpload();


  // Update dimensions on mount and window resize (remains the same)
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Handler for selecting a PREVIOUSLY uploaded document from DocumentSelector
  const handleSelectDocument = useCallback(async (selectedDocId: string, pdfUrl: string) => {
    resetUploadState(); 
    setDocumentIdDirectly(selectedDocId); 

    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error("Failed to fetch PDF");
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPdfFileDirectly(dataUrl); 
        setHasUploadedFileDirectly(true); 
      };
      reader.onerror = () => {
         console.error("Error reading PDF blob for selected document");
         setHasUploadedFileDirectly(false); 
      }
      reader.readAsDataURL(blob);
    } catch (err) {
      console.error("Error fetching selected PDF:", err);
       setHasUploadedFileDirectly(false);
    }
  }, [resetUploadState, setDocumentIdDirectly, setPdfFileDirectly, setHasUploadedFileDirectly]); 

  // Handler for the file input change event
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file); 
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }, [uploadFile]); 

  // Conditional rendering based on whether a file has been successfully uploaded/processed
  if (hasUploadedFile && pdfFile && documentId) {
    return (
      <PDFViewer
        initialPdfFile={pdfFile} 
        initialDocumentId={documentId} 
      />
    );
  }

  // Render the Landing Page content if no file is ready for viewing
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-neutral-50 to-indigo-100 p-8 overflow-hidden">
      <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-12 w-full">
        {/* Logo and Tagline (remains the same) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-4"
        >
          <h1 className="text-5xl font-bold text-neutral-800">
            Ruminate
          </h1>
          <p className="text-2xl font-medium text-neutral-600">
            The AI agent that reads between the lines
          </p>
          <p className="text-lg text-neutral-500 mt-4 max-w-xl mx-auto">
            Upload your document and watch our AI analyze and highlight key insights in real time.
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-8 w-full max-w-md mx-auto"
        >
          {/* Objective Selector (remains the same) */}
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

            {/* Progress Indicator Area - Use the new component */}
            <AnimatePresence>
              {isProcessing && (
                  <UploadProgressIndicator progress={progress} />
              )}
            </AnimatePresence>

             {/* Error Display - Use error from hook */}
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
      </div>

      {/* Floating particles effect (remains the same) */}
      <div className="absolute inset-0 pointer-events-none">
        {dimensions.width > 0 && [...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary-400/20"
            initial={{
              x: Math.random() * dimensions.width,
              y: Math.random() * dimensions.height,
            }}
            animate={{
              y: [null, '-100%'],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>
    </div>
  );
}