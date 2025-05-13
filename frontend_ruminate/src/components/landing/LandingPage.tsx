"use client";

import { useState, useEffect, useCallback } from 'react'; 
import dynamic from 'next/dynamic';
import { useDocumentUpload } from '@/hooks/useDocumentUpload'; 
import Image from 'next/image';

// Import decomposed components
import Header from './Header';
import UploadSection from './UploadSection';

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
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-paper-50 p-4 md:p-8 overflow-hidden">
      {/* Warm paper background */}
      <div className="absolute inset-0 bg-paper-texture opacity-30"></div>
      
      {/* Main container with illustrated border */}
      <div className="relative z-10 w-full max-w-4xl mx-auto my-8 p-6 md:p-12">
        {/* Top right corner illustration */}
        <div className="absolute top-0 right-0 w-48 h-48 md:w-64 md:h-64 pointer-events-none">
          <Image 
            src="/apple_blossom_top_right_corner.png" 
            alt="" 
            width={300} 
            height={300}
            className="object-contain"
          />
        </div>
        
        {/* Top border illustrations - placeholders for now */}
        <div className="absolute top-0 left-0 right-0 h-24 pointer-events-none flex justify-center">
          <div className="w-full max-w-lg h-full bg-contain bg-no-repeat bg-center opacity-90"></div>
        </div>
        
        {/* Content area */}
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8">
          <div className="flex flex-col items-center text-center md:text-left md:items-start space-y-8 w-full md:w-7/12">
            {/* Logo and Tagline */}
            <Header />
            
            {/* Upload Section */}
            <UploadSection
              currentObjective={currentObjective}
              setCurrentObjective={setCurrentObjective}
              isProcessing={isProcessing}
              progress={progress}
              error={error}
              uploadFile={uploadFile}
              handleSelectDocument={handleSelectDocument}
              showObjectiveSelector={false}
            />
          </div>
          
          {/* Dog illustration */}
          <div className="hidden md:block w-5/12 mt-12">
            <Image 
              src="/reading_dog.png" 
              alt="Illustrated dog reading with a magnifying glass"
              width={400} 
              height={400}
              className="object-contain scale-x-[-1]"
              priority
            />
          </div>
        </div>
        
        {/* Bottom border illustrations - placeholder for now */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none flex justify-center">
          <div className="w-full max-w-lg h-full bg-contain bg-no-repeat bg-center opacity-90"></div>
        </div>
      </div>
    </div>
  );
}