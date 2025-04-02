import React, { useEffect, useState } from 'react';

interface Document {
  id: string;
  title: string;
}

interface DocumentSelectorProps {
  onSelectDocument: (documentId: string, pdfUrl: string) => void;
}

export default function DocumentSelector({ onSelectDocument }: DocumentSelectorProps) {
  const [documents, setDocuments] = useState<{[hash: string]: {documentId: string, title: string, blockConversations: {[blockId: string]: string}}}>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load cached documents from localStorage
    const cachedDocuments = JSON.parse(localStorage.getItem('pdfDocuments') || '{}');
    
    // Update document titles if they don't have one
    const updatedDocuments = {...cachedDocuments};
    let hasChanges = false;
    
    for (const hash in updatedDocuments) {
      // If title is missing, add a placeholder
      if (!updatedDocuments[hash].title) {
        updatedDocuments[hash].title = `Document ${updatedDocuments[hash].documentId.substring(0, 8)}`;
        hasChanges = true;
      }
    }
    
    // Save back to localStorage if we made changes
    if (hasChanges) {
      localStorage.setItem('pdfDocuments', JSON.stringify(updatedDocuments));
    }
    
    setDocuments(updatedDocuments);
  }, []);

  const handleSelectDocument = async (hash: string) => {
    if (!hash) return;
    
    setLoading(true);
    try {
      const doc = documents[hash];
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      
      // Get the document to verify it still exists
      const response = await fetch(`${apiUrl}/documents/${doc.documentId}`);
      if (!response.ok) {
        throw new Error("Document no longer exists");
      }
      
      // Get document details to update title if needed
      const documentData = await response.json();
      if (documentData.title && documentData.title !== doc.title) {
        // Update title in localStorage
        const updatedDocuments = {...documents};
        updatedDocuments[hash].title = documentData.title;
        localStorage.setItem('pdfDocuments', JSON.stringify(updatedDocuments));
        setDocuments(updatedDocuments);
      }
      
      // Generate URL for the PDF
      const pdfUrl = `${apiUrl}/documents/${doc.documentId}/pdf`;
      
      // Call the callback with the document ID and PDF URL
      onSelectDocument(doc.documentId, pdfUrl);
    } catch (error) {
      console.error("Error loading document:", error);
      // Remove invalid document from localStorage
      const updatedDocuments = {...documents};
      delete updatedDocuments[hash];
      localStorage.setItem('pdfDocuments', JSON.stringify(updatedDocuments));
      setDocuments(updatedDocuments);
    } finally {
      setLoading(false);
    }
  };

  // If no documents, don't render
  if (Object.keys(documents).length === 0) {
    return null;
  }

  return (
    <div className="relative inline-block w-full">
      <select 
        className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
        onChange={(e) => handleSelectDocument(e.target.value)}
        disabled={loading}
        defaultValue=""
      >
        <option value="" disabled>Select a previous document</option>
        {Object.entries(documents).map(([hash, doc]) => (
          <option key={hash} value={hash}>
            {doc.title || `Document ${doc.documentId.substring(0, 8)}`}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
        <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
          <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
        </svg>
      </div>
      {loading && (
        <div className="absolute right-10 top-2">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}
    </div>
  );
} 