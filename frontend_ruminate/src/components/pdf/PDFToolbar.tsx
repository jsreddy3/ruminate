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
  onResumeReading?: () => void;
  hasReadingProgress?: boolean;
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
  onResumeReading,
  hasReadingProgress,
}) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  
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
      {/* Elegant collapse button - moves down when collapsed */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={`absolute left-1/2 transform -translate-x-1/2 transition-all duration-300 ease-out group z-10 ${
          isCollapsed 
            ? 'top-0 px-4 py-2 bg-gradient-to-r from-surface-paper/95 to-library-cream-100/95 backdrop-blur-paper shadow-shelf rounded-journal border border-library-sage-300/50' 
            : '-top-2 px-3 py-1 bg-gradient-to-br from-library-cream-100 to-surface-parchment shadow-paper rounded-book border border-library-sage-200'
        }`}
        title={isCollapsed ? "Show toolbar" : "Hide toolbar"}
      >
        <div className="flex items-center gap-2">
          <svg className={`w-3 h-3 text-library-sage-500 group-hover:text-reading-primary transition-all duration-200 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
          {isCollapsed && (
            <span className="text-xs font-serif text-reading-secondary group-hover:text-reading-primary transition-colors">
              Show
            </span>
          )}
        </div>
      </button>

      {/* Main toolbar */}
      <div 
        className={`bg-gradient-to-r from-surface-paper/95 to-library-cream-100/95 backdrop-blur-paper shadow-shelf rounded-journal border border-library-sage-300/50 transition-all duration-300 px-6 py-3 flex items-center gap-4 ${
          isCollapsed 
            ? 'opacity-0 pointer-events-none' 
            : 'opacity-100'
        }`}
        style={{
          transform: isCollapsed 
            ? 'scale(0.95)' 
            : isHovered 
              ? 'scale(1.15)' 
              : 'scale(1.0)'
        }}
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
      >
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

          {/* Resume Reading Button - only show if there's reading progress */}
          {hasReadingProgress && (
            <>
              {/* Elegant divider */}
              <div className="w-px h-6 bg-gradient-to-b from-transparent via-library-sage-300 to-transparent opacity-60"></div>
              
              <button
                onClick={onResumeReading}
                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-br from-library-mahogany-100 to-library-mahogany-50 hover:from-library-mahogany-200 hover:to-library-mahogany-100 border border-library-mahogany-200 hover:border-library-mahogany-300 rounded-book text-xs font-serif text-library-mahogany-700 shadow-paper hover:shadow-book transition-all duration-200"
                title="Continue reading from where you left off"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Resume Reading
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PDFToolbar;