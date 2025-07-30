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
  onSearch?: (query: string) => void;
}

const PDFToolbar: React.FC<PDFToolbarProps> = ({
  GoToPreviousPage,
  GoToNextPage,
  ZoomOut,
  ZoomIn,
  currentPage,
  totalPages,
  currentPanelSizes,
  onSearch,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchFocused, setSearchFocused] = React.useState(false);
  
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (searchQuery.trim() && onSearch) {
        onSearch(searchQuery.trim());
      }
    }
  };
  
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    }
  };

  return (
    <div 
      className="absolute bottom-6 z-50"
      style={{
        left: `${currentPanelSizes[0] / 2}%`,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="bg-gradient-to-r from-surface-paper/95 to-library-cream-100/95 backdrop-blur-paper shadow-shelf rounded-journal px-6 py-3 flex items-center gap-4 border border-library-sage-300/50">
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

          {/* Elegant divider */}
          <div className="w-px h-6 bg-gradient-to-b from-transparent via-library-sage-300 to-transparent opacity-60"></div>

          {/* Search with scholarly styling */}
          <form onSubmit={handleSearchSubmit} className="relative">
            <div className={`flex items-center transition-all duration-300 ${searchFocused ? 'w-48' : 'w-32'}`}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search text..."
                className="w-full px-3 py-1.5 bg-gradient-to-br from-library-cream-100 to-surface-parchment border border-library-sage-200 rounded-book text-xs font-serif text-reading-primary placeholder-reading-secondary/60 shadow-paper focus:outline-none focus:ring-1 focus:ring-library-sage-400 focus:border-library-sage-400 transition-all"
              />
              <button
                type="submit"
                className="ml-2 p-1.5 text-reading-secondary hover:text-reading-primary transition-colors rounded-book hover:bg-library-cream-100"
                title="Search (⌘↩)"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PDFToolbar;