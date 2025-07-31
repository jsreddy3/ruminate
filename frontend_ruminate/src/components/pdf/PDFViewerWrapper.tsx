'use client';

import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const PDFViewer = dynamic(() => import('./PDFViewer'), {
  ssr: false,
});

export default function PDFViewerWrapper() {
  const searchParams = useSearchParams();
  const [pdfFile, setPdfFile] = useState('');
  const [documentId, setDocumentId] = useState('');

  useEffect(() => {
    // Get PDF file URL and document ID from URL params or use defaults
    const fileParam = searchParams.get('file') || '/sample.pdf';
    const docIdParam = searchParams.get('docId') || 'default-document-id';
    
    setPdfFile(fileParam);
    setDocumentId(docIdParam);
  }, [searchParams]);

  // Only render the PDFViewer when we have the necessary props
  if (!pdfFile || !documentId) {
    return <div className="p-4">Loading...</div>;
  }

  return <PDFViewer initialPdfFile={pdfFile} initialDocumentId={documentId} />;
}
