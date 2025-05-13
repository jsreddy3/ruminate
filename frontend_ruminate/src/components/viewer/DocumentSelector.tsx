import React, { useEffect, useState } from 'react';
import { Document, documentApi } from '@/services/api/document';

interface DocumentSelectorProps {
  onSelectDocument: (documentId: string, pdfUrl: string) => void;
}

export default function DocumentSelector({ onSelectDocument }: DocumentSelectorProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch documents on component mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setLoading(true);
        const docs = await documentApi.getAllDocuments();
        // Filter to only show documents that are ready
        const readyDocs = docs.filter(doc => doc.status === 'READY');
        setDocuments(readyDocs);
        setError(null);
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const handleSelectDocument = async (documentId: string) => {
    if (!documentId) return;
    
    setLoading(true);
    try {
      // Get the document data URL
      const pdfDataUrl = await documentApi.getPdfDataUrl(documentId);
      
      // Call the callback with the document ID and PDF URL
      onSelectDocument(documentId, pdfDataUrl);
    } catch (error) {
      console.error("Error loading document:", error);
      setError('Failed to load the selected document');
    } finally {
      setLoading(false);
    }
  };

  // If no documents or still loading initially, show appropriate message
  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 border border-paper-200 rounded-md bg-paper-50 text-ink-700">
        <svg className="animate-spin h-5 w-5 mr-3 text-terracotta-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="font-light">Loading your documents...</span>
      </div>
    );
  }

  // If no documents after loading completes
  if (!loading && documents.length === 0) {
    return (
      <div className="p-4 border border-paper-200 rounded-md bg-paper-50 text-ink-600 text-center font-light italic">
        No previous documents available. Upload your first document.
      </div>
    );
  }

  // If there's an error
  if (error && !loading) {
    return (
      <div className="p-4 border border-paper-200 rounded-md bg-terracotta-50 text-terracotta-600 text-center font-light">
        {error}
      </div>
    );
  }

  // Render document selector
  return (
    <div className="relative inline-block w-full">
      <select 
        className="block appearance-none w-full bg-paper-50 border border-paper-300
                  px-4 py-2 pr-8 rounded-md shadow-sm
                  focus:outline-none focus:ring-1 focus:ring-terracotta-400 
                  text-ink-700 font-light transition-all duration-300"
        onChange={(e) => handleSelectDocument(e.target.value)}
        disabled={loading}
        defaultValue=""
      >
        <option value="" disabled className="text-ink-500">Select a previous document</option>
        {documents.map((doc) => (
          <option key={doc.id} value={doc.id}>
            {doc.title || `Document ${doc.id.substring(0, 8)}`}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-ink-600">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
      {loading && (
        <div className="absolute right-10 top-2">
          <svg className="animate-spin h-5 w-5 text-terracotta-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}