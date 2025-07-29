"use client";

import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const PDFViewer = dynamic(() => import('@/components/pdf/PDFViewer'), {
  ssr: false,
});

function ViewerContent() {
  const searchParams = useSearchParams();
  const documentId = searchParams.get('documentId');
  const pdfUrl = searchParams.get('pdfUrl');

  if (!documentId || !pdfUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">No document selected</p>
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