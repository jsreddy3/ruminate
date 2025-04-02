"use client";

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import ObjectiveSelector from '../viewer/ObjectiveSelector';
import DocumentSelector from '../viewer/DocumentSelector';

// Dynamically import PDFViewer
const PDFViewer = dynamic(() => import('../pdf/PDFViewer'), {
  ssr: false,
});

// Add utility function for hash calculation
async function calculateHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Add a type for our cache structure
interface CachedDocument {
  documentId: string;
  title: string;
  blockConversations: {[blockId: string]: string};
}

export default function LandingPage() {
  const [hasUploadedFile, setHasUploadedFile] = useState(false);
  const [currentObjective, setCurrentObjective] = useState("Focus on key vocabulary and jargon that a novice reader would not be familiar with.");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Update dimensions on mount and window resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // Initial dimensions
    updateDimensions();

    // Update on resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const handleSelectDocument = (selectedDocId: string, pdfUrl: string) => {
    setLoading(true);
    setDocumentId(selectedDocId);
    
    // Fetch the PDF file from the server
    fetch(pdfUrl)
      .then(response => {
        if (!response.ok) throw new Error("Failed to fetch PDF");
        return response.blob();
      })
      .then(blob => {
        // Create a data URL from the blob - this is more compatible with how 
        // the PDFViewer expects data when uploading files directly
        const reader = new FileReader();
        reader.onloadend = () => {
          // The result is a data URL like when uploading a file directly
          const dataUrl = reader.result as string;
          setPdfFile(dataUrl);
          setHasUploadedFile(true);
          setLoading(false);
        };
        reader.readAsDataURL(blob);
      })
      .catch(err => {
        console.error("Error fetching PDF:", err);
        setError("Failed to load the selected document");
        setLoading(false);
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    
    try {
      // Calculate file hash
      const fileHash = await calculateHash(file);
      
      // Check localStorage for existing document data
      const cachedDocuments = JSON.parse(localStorage.getItem('pdfDocuments') || '{}') as {[hash: string]: CachedDocument};
      const cachedData = cachedDocuments[fileHash];
      
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      
      if (cachedData) {
        // Try to fetch the existing document
        try {
          const docResponse = await fetch(`${apiUrl}/documents/${cachedData.documentId}`);
          if (docResponse.ok) {
            const docData = await docResponse.json();
            if (docData.status === "READY") {
              // Cached document exists and is ready
              setDocumentId(cachedData.documentId);
              
              // Set PDF file for viewing
              const reader = new FileReader();
              reader.onload = (e) => {
                setPdfFile(e.target?.result as string);
                setHasUploadedFile(true);
              };
              reader.readAsDataURL(file);
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.log('Cached document not found, processing as new upload');
        }
      }
      
      // If we get here, either no cached document or it wasn't valid
      // Process as new upload
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${apiUrl}/documents/`, {
          method: "POST",
          body: formData,
        });
        const data = await response.json();
        const docId = data.id;
        setDocumentId(docId);

        // Store the new document data in localStorage with title
        cachedDocuments[fileHash] = {
          documentId: docId,
          title: file.name || `Document ${docId.substring(0, 8)}`,
          blockConversations: {}  // Start with empty conversations
        };
        localStorage.setItem('pdfDocuments', JSON.stringify(cachedDocuments));

        // Poll until document status becomes "READY"
        let status = data.status;
        while (status !== "READY") {
          const statusResp = await fetch(`${apiUrl}/documents/${docId}`);
          const docData = await statusResp.json();
          status = docData.status;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setPdfFile(base64);
        setHasUploadedFile(true);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Error processing PDF:", err);
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
    }
    setLoading(false);
  };

  if (hasUploadedFile && documentId && pdfFile) {
    return <PDFViewer initialPdfFile={pdfFile} initialDocumentId={documentId} />;
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-neutral-50 to-neutral-100 overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear',
          }}
          style={{
            backgroundImage: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.3) 0%, transparent 50%)',
            backgroundSize: '100% 100%',
          }}
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center space-y-8">
        {/* Logo and Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="space-y-4"
        >
          <h1 className="text-5xl font-bold text-neutral-800">
            Ruminate
          </h1>
          <p className="text-2xl font-medium text-neutral-600">
            The AI agent that reads between the lines
          </p>
          <p className="text-lg text-neutral-500 mt-4 max-w-xl mx-auto">
            Upload your document and watch our AI analyze and highlight key insights in real time.
          </p>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="space-y-8 w-full max-w-md mx-auto"
        >
          {/* Objective Selector */}
          <div className="text-center flex flex-col items-center w-full">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Rumination Objective
            </label>
            <div className="flex justify-center w-full">
              <ObjectiveSelector onObjectiveChange={setCurrentObjective} />
            </div>
          </div>

          {/* Previously Uploaded Documents */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4 text-neutral-700">Previously Uploaded Documents</h2>
            <DocumentSelector onSelectDocument={handleSelectDocument} />
          </div>

          {/* Upload Button */}
          <div className="relative flex flex-col items-center gap-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
              ref={fileInputRef}
            />
            <motion.button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-4 bg-primary-600 text-white rounded-xl shadow-lg
                       hover:bg-primary-700 hover:shadow-xl
                       transition-all duration-200
                       flex items-center gap-3 group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
            >
              <svg 
                className="w-6 h-6 transition-transform duration-200 group-hover:rotate-6" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" 
                />
              </svg>
              <span className="text-lg font-medium">{loading ? "Processing..." : "Upload PDF"}</span>
            </motion.button>
            
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-600 text-sm"
              >
                {error}
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 pointer-events-none">
        {dimensions.width > 0 && [...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary-400/20"
            initial={{
              x: Math.random() * dimensions.width,
              y: Math.random() * dimensions.height,
            }}
            animate={{
              y: [null, '-100%'],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: Math.random() * 5 + 5,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>
    </div>
  );
} 