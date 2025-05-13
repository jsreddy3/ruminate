"use client";

import { useState, useEffect, useCallback } from 'react'; 
import dynamic from 'next/dynamic';
import { useDocumentUpload } from '@/hooks/useDocumentUpload'; 

// Import decomposed components
import Header from './Header';
import UploadSection from './UploadSection';
import ParticlesBackground from './ParticlesBackground';

// Dynamically import PDFViewer
const PDFViewer = dynamic(() => import('../pdf/PDFViewer'), {
  ssr: false,
});

export default function LandingPage() {
  // State managed by the component
  const [currentObjective, setCurrentObjective] = useState("Focus on key vocabulary and jargon that a novice reader would not be familiar with.");
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

  // Update dimensions on mount and window resize
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

  // Handler for selecting a previously uploaded document
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
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-paper-50 p-6 md:p-12 overflow-hidden">
      {/* Background with paper texture */}
      <div className="absolute inset-0 bg-paper-texture opacity-30"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-16 w-full max-w-4xl mx-auto my-8">
        {/* Title and decorative element */}
        <div className="w-full flex flex-col items-center">
          <Header />
        </div>

        {/* Upload Section with decorative frame */}
        <div className="w-full relative">
          {/* Decorative elements - these will be replaced with your SVGs */}
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 w-16 h-2 border-t border-paper-300"></div>
          
          <UploadSection
            currentObjective={currentObjective}
            setCurrentObjective={setCurrentObjective}
            isProcessing={isProcessing}
            progress={progress}
            error={error}
            uploadFile={uploadFile}
            handleSelectDocument={handleSelectDocument}
          />
          
          {/* Bottom decorative element */}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 w-16 h-2 border-b border-paper-300"></div>
        </div>
      </div>

      {/* Floating particles effect */}
      <ParticlesBackground dimensions={dimensions} />
    </div>
  );
}