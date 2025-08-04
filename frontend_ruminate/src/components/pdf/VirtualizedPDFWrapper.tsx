"use client";

import dynamic from 'next/dynamic';
import React from 'react';

// Dynamically import the VirtualizedPDFViewer to avoid SSR issues
const VirtualizedPDFViewer = dynamic(() => import('./VirtualizedPDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="bg-white rounded-journal shadow-shelf p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-library-mahogany-600 mx-auto"></div>
        <p className="mt-4 text-reading-secondary">Loading PDF viewer...</p>
      </div>
    </div>
  )
});

// Re-export with same interface
export default VirtualizedPDFViewer;