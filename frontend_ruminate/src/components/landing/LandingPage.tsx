"use client";

import { useState, useEffect, useCallback } from 'react'; 
import dynamic from 'next/dynamic';
import { useDocumentUpload } from '@/hooks/useDocumentUpload'; 
import Image from 'next/image';

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
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-paper-50 overflow-hidden">
      {/* Background with paper texture */}
      <div className="absolute inset-0 bg-paper-texture opacity-30"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center text-center w-full mx-auto">
        {/* Title and header section */}
        <div className="w-full flex flex-col items-center mt-12 mb-8">
          <Header />
        </div>

        {/* Main content with illustrations */}
        <div className="w-full max-w-6xl mx-auto px-6 relative flex flex-col items-center">
          {/* Reading glasses illustration above upload section */}
          <div className="relative mx-auto mb-8">
            <Image 
              src="/reading_glasses.png" 
              alt="Reading glasses" 
              width={100} 
              height={50}
              priority
              className="object-contain"
            />
          </div>

          {/* Main content container with illustrations */}
          <div className="w-full flex justify-center items-stretch relative">
            {/* Robot illustration (left side) */}
            <div className="hidden lg:block absolute left-0 bottom-0 z-10" style={{ transform: 'translateX(-45%) translateY(15%)' }}>
              <Image 
                src="/reading_robot_transparent.png" 
                alt="Robot reading a book" 
                width={280} 
                height={280}
                priority
                className="object-contain"
              />
            </div>

            {/* Upload section inside a differently shaded container */}
            <div className="w-full max-w-xl bg-paper-50 border border-paper-200 rounded-md py-6 px-8 shadow-sm relative">
              <UploadSection
                currentObjective={currentObjective}
                setCurrentObjective={setCurrentObjective}
                isProcessing={isProcessing}
                progress={progress}
                error={error}
                uploadFile={uploadFile}
                handleSelectDocument={handleSelectDocument}
              />
            </div>

            {/* Coffee on book illustration (right side) */}
            <div className="hidden lg:block absolute right-0 bottom-0 z-10" style={{ transform: 'translateX(45%) translateY(20%)' }}>
              <Image 
                src="/coffee_on_book_transparent.png" 
                alt="Coffee cup on a book" 
                width={280} 
                height={280}
                priority
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating particles effect */}
      <ParticlesBackground dimensions={dimensions} />
    </div>
  );
}