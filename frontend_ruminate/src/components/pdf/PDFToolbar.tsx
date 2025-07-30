import React from 'react';
import { useRouter } from 'next/navigation';

interface PDFToolbarProps {
  GoToPreviousPage: React.ComponentType;
  GoToNextPage: React.ComponentType;
  ZoomOut: React.ComponentType;
  ZoomIn: React.ComponentType;
  currentPage: number;
  totalPages: number;
  currentPanelSizes: number[];
}

const PDFToolbar: React.FC<PDFToolbarProps> = ({
  GoToPreviousPage,
  GoToNextPage,
  ZoomOut,
  ZoomIn,
  currentPage,
  totalPages,
  currentPanelSizes,
}) => {
  const router = useRouter();

  return (
    <div 
      className="absolute bottom-6 z-50"
      style={{
        left: `${currentPanelSizes[0] / 2}%`,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="bg-white/95 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 flex items-center gap-3 border border-gray-200">
        {/* Back Button */}
        <button
          onClick={() => router.push('/home')}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all duration-200"
          title="Back to Home"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back</span>
        </button>

        <div className="w-px h-6 bg-gray-300"></div>

        {/* Toolbar controls */}
        <div className="flex items-center gap-2">
          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <GoToPreviousPage />
            <div className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-600 min-w-[3rem] text-center">
              {currentPage}/{totalPages}
            </div>
            <GoToNextPage />
          </div>

          <div className="w-px h-6 bg-gray-300"></div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <ZoomOut />
            <ZoomIn />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFToolbar;