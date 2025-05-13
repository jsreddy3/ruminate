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
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      {/* Old paper background */}
      <div className="absolute inset-0 bg-[url('/old_paper_background.jpg')] bg-cover bg-center"></div>
      
      {/* Top left corner border decoration */}
      <div className="fixed top-0 left-0 w-1/2 h-auto pointer-events-none z-20">
        <Image 
          src="/top left border.png" 
          alt="" 
          width={800} 
          height={800}
          className="object-contain w-full"
          priority
        />
      </div>
      
      {/* Bottom left border decoration */}
      <div className="fixed bottom-0 left-0 w-1/2 h-auto pointer-events-none z-20 flex items-end">
        <Image 
          src="/bottom left border.png" 
          alt="" 
          width={800} 
          height={800}
          className="object-contain w-full"
          priority
        />
      </div>
      
      {/* Top right corner illustration - fixed to viewport */}
      <div className="fixed top-0 right-0 w-1/2 h-auto pointer-events-none z-20">
        <Image 
          src="/apple_blossom_top_right_corner.png" 
          alt="" 
          width={800} 
          height={800}
          className="object-contain w-full"
          priority
        />
      </div>
      
      {/* Main container with centered content */}
      <div className="relative z-10 w-full max-w-6xl mx-auto my-8 p-6 md:p-16 flex flex-col items-center justify-center">
        {/* Centered title and tagline */}
        <div className="text-center mb-16">
          <Header />
        </div>

        {/* Dog illustration - repositioned to be next to header */}
        <div className="absolute right-0 top-0 md:top-[-20px] w-40 md:w-96 opacity-100 hidden md:block">
          <Image 
            src="/reading_dog.png" 
            alt="Illustrated dog reading with a magnifying glass"
            width={500} 
            height={500}
            className="object-contain scale-x-[-1]"
            priority
          />
        </div>
        
        {/* Upload Section - centered */}
        <div className="w-full max-w-md">
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
      </div>
    </div>
  );
}