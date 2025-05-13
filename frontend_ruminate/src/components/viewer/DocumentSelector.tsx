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
      <div 
        className="flex items-center justify-center text-ink-700 h-12"
        style={{
          backgroundImage: 'url("/document_selector.png")',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center'
        }}
      >
        <svg className="animate-spin h-4 w-4 mr-2 text-terracotta-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="font-serif italic text-sm">Loading...</span>
      </div>
    );
  }

  // If no documents after loading completes
  if (!loading && documents.length === 0) {
    return (
      <div 
        className="text-ink-700 text-center font-serif italic text-sm h-12 flex items-center justify-center"
        style={{
          backgroundImage: 'url("/document_selector.png")',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center'
        }}
      >
        No documents available
      </div>
    );
  }

  // If there's an error
  if (error && !loading) {
    return (
      <div 
        className="text-terracotta-700 text-center font-serif italic text-sm h-12 flex items-center justify-center"
        style={{
          backgroundImage: 'url("/document_selector.png")',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center'
        }}
      >
        {error}
      </div>
    );
  }

  // Render document selector
  return (
    <div className="relative inline-block w-full">
      <div 
        className="relative"
        style={{
          backgroundImage: 'url("/document_selector.png")',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          paddingTop: '8px',
          paddingBottom: '8px',
          height: '40px'
        }}
      >
        <select 
          className="block bg-transparent border-none focus:outline-none text-ink-800 font-serif text-base transition-all duration-300"
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            width: '75%',
            margin: '0 auto',
            display: 'block',
            height: '24px'
          }}
          onChange={(e) => handleSelectDocument(e.target.value)}
          disabled={loading}
          defaultValue=""
        >
          <option value="" disabled className="text-ink-500 bg-paper-100">Select a document</option>
          {documents.map((doc) => (
            <option key={doc.id} value={doc.id} className="py-1 font-serif bg-paper-100 text-base">
              {doc.title || `Document ${doc.id.substring(0, 8)}`}
            </option>
          ))}
        </select>
      </div>
      {loading && (
        <div className="absolute right-[25%] top-1/2 transform -translate-y-1/2">
          <svg className="animate-spin h-3 w-3 text-terracotta-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
}