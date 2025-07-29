"use client";

import { useState, useEffect, useCallback } from 'react'; 
import dynamic from 'next/dynamic';
import { useDocumentUpload } from '@/hooks/useDocumentUpload'; 
import { useAuth } from '@/contexts/AuthContext';

// Import decomposed components
import Header from './Header';
import UploadSection from './UploadSection';
import ParticlesBackground from './ParticlesBackground';

// Dynamically import PDFViewer
const PDFViewer = dynamic(() => import('../pdf/PDFViewer'), {
  ssr: false,
});

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  
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
    
    // Use the S3 URL directly instead of converting to base64
    setPdfFileDirectly(pdfUrl); 
    setHasUploadedFileDirectly(true); 
  }, [resetUploadState, setDocumentIdDirectly, setPdfFileDirectly, setHasUploadedFileDirectly]); 

  // Conditional rendering based on whether a file has been successfully uploaded/processed
  if (hasUploadedFile && pdfFile && documentId && user) {
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
        {/* Logo and Tagline */}
        <Header />

        {/* Upload Section - only show if user is authenticated */}
        {user && !isLoading && (
          <UploadSection
            currentObjective={currentObjective}
            setCurrentObjective={setCurrentObjective}
            isProcessing={isProcessing}
            progress={progress}
            error={error}
            uploadFile={uploadFile}
            handleSelectDocument={handleSelectDocument}
          />
        )}

        {/* Show message if not authenticated */}
        {!user && !isLoading && (
          <div className="max-w-md mx-auto p-6 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg border border-white border-opacity-20">
            <p className="text-lg text-neutral-700 mb-2">Welcome to Ruminate!</p>
            <p className="text-neutral-600">Sign in with Google to start analyzing your documents with AI.</p>
          </div>
        )}
      </div>

      {/* Floating particles effect */}
      <ParticlesBackground dimensions={dimensions} />
    </div>
  );
}