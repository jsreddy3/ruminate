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
      <div className="bg-gradient-to-r from-surface-paper/95 to-library-cream-100/95 backdrop-blur-paper shadow-shelf rounded-journal px-6 py-3 flex items-center gap-4 border border-library-sage-300/50">
        {/* Elegant back button */}
        <button
          onClick={() => router.push('/home')}
          className="group flex items-center gap-2 px-4 py-2 text-sm text-reading-secondary hover:text-reading-primary hover:bg-library-cream-100 rounded-book transition-all duration-300 shadow-paper hover:shadow-book"
          title="Return to Library"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-serif font-medium">Library</span>
        </button>

        {/* Elegant divider */}
        <div className="w-px h-6 bg-gradient-to-b from-transparent via-library-sage-300 to-transparent opacity-60"></div>

        {/* Scholarly toolbar controls */}
        <div className="flex items-center gap-3">
          {/* Page Navigation */}
          <div className="flex items-center gap-2">
            <GoToPreviousPage />
            <div className="px-3 py-1.5 bg-gradient-to-br from-library-cream-100 to-surface-parchment border border-library-sage-200 rounded-book text-xs font-serif text-reading-primary min-w-[3.5rem] text-center shadow-paper">
              {currentPage} of {totalPages}
            </div>
            <GoToNextPage />
          </div>

          {/* Elegant divider */}
          <div className="w-px h-6 bg-gradient-to-b from-transparent via-library-sage-300 to-transparent opacity-60"></div>

          {/* Zoom Controls with scholarly styling */}
          <div className="flex items-center gap-2">
            <ZoomOut />
            <ZoomIn />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PDFToolbar;