"use client";

import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { documentApi } from '@/services/api/document';
import { useAuth } from '@/contexts/AuthContext';

const PDFViewer = dynamic(() => import('@/components/pdf/PDFViewer_working'), {
  ssr: false,
});

function ViewerContent() {
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const documentId = params.documentId as string;

  useEffect(() => {
    const fetchPdfUrl = async () => {
      if (!documentId || authLoading || !user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        const url = await documentApi.getPdfUrl(documentId);
        setPdfUrl(url);
      } catch (err) {
        console.error('Error fetching PDF URL:', err);
        setError('Failed to load document. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPdfUrl();
  }, [documentId, authLoading, user]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!documentId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">No document selected</p>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Document not found</p>
      </div>
    );
  }

  return (
    <PDFViewer
      initialPdfFile={pdfUrl}
      initialDocumentId={documentId}
    />
  );
}

export default function ViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    }>
      <ViewerContent />
    </Suspense>
  );
}