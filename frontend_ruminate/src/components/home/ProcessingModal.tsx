"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UploadProgressSteps from './UploadProgressSteps';
import { DocumentProcessingEvent, DocumentStatus } from '@/types';
import { API_BASE_URL } from '@/utils/api';
import { useRouter } from 'next/navigation';

interface ProcessingModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProcessingModal({ documentId, isOpen, onClose }: ProcessingModalProps) {
  const router = useRouter();
  const [processingEvents, setProcessingEvents] = useState<DocumentProcessingEvent[]>([]);
  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>('PENDING');
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isOpen || !documentId) return;

    // Start SSE listening
    const token = localStorage.getItem('auth_token');
    const eventSourceUrl = `${API_BASE_URL}/documents/${documentId}/processing-stream`;
    const authenticatedEventSourceUrl = token ? `${eventSourceUrl}?token=${token}` : eventSourceUrl;
    const es = new EventSource(authenticatedEventSourceUrl);
    eventSourceRef.current = es;

    // Add initial event
    addProcessingEvent('processing_start', 'PROCESSING_START', 'Starting document processing...');

    es.onmessage = async (event) => {
      try {
        let eventData;
        
        // Handle case where event.data might contain full SSE format
        if (event.data.includes('event:') && event.data.includes('data:')) {
          // Extract JSON from SSE format
          const lines = event.data.split('\n');
          const dataLine = lines.find((line: string) => line.startsWith('data:'));
          if (dataLine) {
            const jsonStr = dataLine.substring(5).trim(); // Remove 'data:' prefix
            eventData = JSON.parse(jsonStr);
          } else {
            throw new Error('No data line found in SSE message');
          }
        } else {
          // Standard case - event.data should be JSON
          eventData = JSON.parse(event.data);
        }
        
        const status = eventData.status as DocumentStatus;
        const message = eventData.message || eventData.detail;
        const error = eventData.error;
        
        // Map backend statuses to user-friendly messages
        const getDisplayMessage = (status: DocumentStatus, message?: string) => {
          switch (status) {
            case 'PROCESSING_MARKER':
              return 'Our AI is carefully reading through your document...';
            case 'ANALYZING_CONTENT':
              return 'Creating an intelligent summary of your content...';
            case 'ANALYSIS_COMPLETE':
              return 'Almost ready! Finalizing everything...';
            case 'READY':
              return 'Your document is ready to explore!';
            case 'ERROR':
              return error || message || 'Something went wrong during processing';
            default:
              return message || `Processing: ${status}`;
          }
        };
        
        addProcessingEvent(
          event.type || 'processing_update',
          status,
          getDisplayMessage(status, message),
          error
        );

        // Handle completion
        if (status === 'READY') {
          es.close();
          // Navigate to viewer with clean URL
          setTimeout(() => {
            router.push(`/viewer/${documentId}`);
          }, 1000);
        } else if (status === 'ERROR') {
          es.close();
          setError(getDisplayMessage(status, message));
        }
      } catch (parseError) {
        console.error("Failed to parse SSE message:", parseError);
        setError("Communication error during processing");
        es.close();
      }
    };

    es.onerror = () => {
      console.error("EventSource failed");
      setError("Connection error during processing");
      es.close();
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isOpen, documentId, router]);

  const addProcessingEvent = (eventType: string, status: DocumentStatus, message?: string, error?: string) => {
    const event: DocumentProcessingEvent = {
      event_type: eventType,
      status,
      document_id: documentId,
      message,
      error,
      timestamp: new Date().toISOString()
    };
    
    setProcessingEvents(prev => [...prev, event]);
    setCurrentStatus(status);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={currentStatus === 'ERROR' ? onClose : undefined}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Processing Your Document
                </h2>
                {currentStatus === 'ERROR' && (
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              <div className="mb-6">
                <UploadProgressSteps 
                  events={processingEvents}
                  currentStatus={currentStatus}
                  error={error || undefined}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}