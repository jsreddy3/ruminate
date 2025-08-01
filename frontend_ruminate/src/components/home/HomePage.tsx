"use client";

import { useState, useEffect, useCallback } from 'react';
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

    // Navigate to the viewer - it will fetch the PDF URL securely
    router.push(`/viewer/${document.id}`);
  };

  const handleUploadComplete = useCallback(async () => {
    // Refresh the documents list
    try {
      const docs = await documentApi.getAllDocuments();
      setDocuments(docs);
    } catch (err) {
      console.error('Error refreshing documents:', err);
    }
  }, []);

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

  const handleDocumentUpdate = (updatedDocument: Document) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === updatedDocument.id ? updatedDocument : doc
    ));
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

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-library-mahogany-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-paper">
      {/* Header */}
      <header className="bg-surface-parchment shadow-paper border-b border-library-cream-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-5xl font-serif font-bold text-reading-primary">Ruminate</h1>
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
          <div className="bg-surface-parchment rounded-journal shadow-book border border-library-cream-300">
            <div className="px-6 py-4 border-b border-library-cream-300">
              <h2 className="text-3xl font-serif font-semibold text-reading-primary">Your Library</h2>
              <p className="text-xl text-reading-muted mt-1">
                {documents.length} {documents.length === 1 ? 'document' : 'documents'}
              </p>
            </div>

            {/* Documents Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-library-mahogany-500"></div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-red-600">{error}</p>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <svg
                  className="mx-auto h-12 w-12 text-reading-muted"
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
                <p className="mt-4 text-2xl text-reading-secondary font-serif">Your library is empty</p>
                <p className="text-xl text-reading-muted mt-2">Upload a document to begin your journey</p>
              </div>
            ) : (
              <DocumentTable 
                documents={documents} 
                onDocumentClick={handleDocumentClick}
                onDocumentDelete={handleDeleteRequest}
                onDocumentUpdate={handleDocumentUpdate}
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