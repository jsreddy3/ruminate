"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { documentApi } from '@/services/api/document';
import { Document } from '@/services/api/document';
import DocumentTable from './DocumentTable';
import UploadButton from './UploadButton';
import UserMenu from './UserMenu';
import ConfirmationDialog from '../common/ConfirmationDialog';

export default function HomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; documentId: string; documentTitle: string }>({ isOpen: false, documentId: '', documentTitle: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirect to landing if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  // Fetch documents
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        const docs = await documentApi.getAllDocuments();
        setDocuments(docs);
        setError(null);
      } catch (err) {
        console.error('Error fetching documents:', err);
        setError('Failed to load documents');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, [user]);

  const handleDocumentClick = async (document: Document) => {
    if (document.status !== 'READY') {
      alert('This document is still processing. Please wait until it\'s ready.');
      return;
    }

    try {
      // Get the PDF URL
      const pdfUrl = await documentApi.getPdfUrl(document.id);
      
      // Navigate to the viewer with the document
      router.push(`/viewer?documentId=${document.id}&pdfUrl=${encodeURIComponent(pdfUrl)}`);
    } catch (err) {
      console.error('Error opening document:', err);
      alert('Failed to open document. Please try again.');
    }
  };

  const handleUploadComplete = async () => {
    // Refresh the documents list
    const docs = await documentApi.getAllDocuments();
    setDocuments(docs);
  };

  const handleDeleteRequest = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      setDeleteConfirm({
        isOpen: true,
        documentId: documentId,
        documentTitle: document.title
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.documentId) return;

    setIsDeleting(true);
    try {
      await documentApi.deleteDocument(deleteConfirm.documentId);
      
      // Remove the document from the local state
      setDocuments(prev => prev.filter(doc => doc.id !== deleteConfirm.documentId));
      
      // Close the dialog
      setDeleteConfirm({ isOpen: false, documentId: '', documentTitle: '' });
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Failed to delete document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    if (!isDeleting) {
      setDeleteConfirm({ isOpen: false, documentId: '', documentTitle: '' });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">Ruminate</h1>
            </div>
            <div className="flex items-center gap-4">
              <UploadButton onUploadComplete={handleUploadComplete} />
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Documents Section */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Your Documents</h2>
              <p className="text-sm text-gray-500 mt-1">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'}
              </p>
            </div>

            {/* Documents Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="mt-4 text-gray-500">No documents uploaded yet</p>
                <p className="text-sm text-gray-400 mt-2">Upload a PDF to get started</p>
              </div>
            ) : (
              <DocumentTable 
                documents={documents} 
                onDocumentClick={handleDocumentClick}
                onDocumentDelete={handleDeleteRequest}
              />
            )}
          </div>
        </motion.div>
      </main>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteConfirm.documentTitle}"? This action cannot be undone and will remove all associated data including conversations and annotations.`}
        confirmText="Delete Document"
        cancelText="Keep Document"
        isDestructive={true}
        isLoading={isDeleting}
      />
    </div>
  );
}