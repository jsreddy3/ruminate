import React, { useMemo, useState } from 'react';
import { Book, Search, ArrowUpDown, Filter } from 'lucide-react';
import { Block } from '../../pdf/PDFViewer';

interface GlossaryEntry {
  term: string;
  definition: string;
  textStartOffset: number;
  textEndOffset: number;
  createdAt: string;
  blockId: string;
  blockType: string;
  pageNumber?: number;
}

interface GlossaryViewProps {
  blocks: Block[];
  onTermClick?: (blockId: string, startOffset: number, endOffset: number) => void;
  className?: string;
}

const GlossaryView: React.FC<GlossaryViewProps> = ({
  blocks,
  onTermClick,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'chronological'>('alphabetical');
  const [filterBy, setFilterBy] = useState<'all' | 'recent'>('all');

  // Extract and aggregate all definitions from block metadata
  const glossaryEntries = useMemo(() => {
    const entries: GlossaryEntry[] = [];
    
    blocks.forEach(block => {
      if (block.metadata?.definitions) {
        Object.entries(block.metadata.definitions).forEach(([key, definition]) => {
          entries.push({
            term: definition.term,
            definition: definition.definition,
            textStartOffset: key.split('-')[0] ? parseInt(key.split('-')[0]) : 0,
            textEndOffset: key.split('-')[1] ? parseInt(key.split('-')[1]) : 0,
            createdAt: definition.created_at,
            blockId: block.id,
            blockType: block.block_type,
            pageNumber: block.page_number
          });
        });
      }
    });

    return entries;
  }, [blocks]);

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    let filtered = glossaryEntries;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.term.toLowerCase().includes(searchLower) ||
        entry.definition.toLowerCase().includes(searchLower)
      );
    }

    // Apply time filter
    if (filterBy === 'recent') {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      filtered = filtered.filter(entry => 
        new Date(entry.createdAt) > threeDaysAgo
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return a.term.toLowerCase().localeCompare(b.term.toLowerCase());
      } else {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [glossaryEntries, searchTerm, sortBy, filterBy]);

  // Group entries by first letter for alphabetical view
  const groupedEntries = useMemo(() => {
    if (sortBy !== 'alphabetical') return {};
    
    return filteredAndSortedEntries.reduce((groups, entry) => {
      const firstLetter = entry.term.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(entry);
      return groups;
    }, {} as Record<string, GlossaryEntry[]>);
  }, [filteredAndSortedEntries, sortBy]);

  const handleTermClick = (entry: GlossaryEntry) => {
    if (onTermClick) {
      onTermClick(entry.blockId, entry.textStartOffset, entry.textEndOffset);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`h-full flex flex-col bg-gradient-to-b from-surface-paper to-library-cream-50 ${className}`}>
      {/* Glossary Header */}
      <div className="sticky top-0 z-10 bg-surface-paper/95 backdrop-blur-sm border-b border-library-gold-200 p-6">
        <div className="w-full max-w-none px-4">
          <div className="flex items-center gap-3 mb-4">
            <Book className="text-library-gold-600" size={28} />
            <h1 className="text-2xl font-serif text-reading-primary">Document Glossary</h1>
            <span className="text-base text-reading-muted font-serif">
              {filteredAndSortedEntries.length} definitions
            </span>
          </div>

          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search Bar */}
            <div className="relative flex-1">
              <Search 
                className="absolute top-1/2 transform -translate-y-1/2 text-reading-muted" 
                style={{ left: '12px' }}
                size={16} 
              />
              <input
                type="text"
                placeholder="Search terms and definitions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-4 py-2 border border-library-sage-200 rounded-paper focus:outline-none focus:ring-2 focus:ring-library-gold-400 focus:border-transparent bg-white text-reading-primary font-serif"
                style={{ paddingLeft: '40px' }}
              />
            </div>

            {/* Sort Controls */}
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy(sortBy === 'alphabetical' ? 'chronological' : 'alphabetical')}
                className={`flex items-center gap-1 px-3 py-2 rounded-paper border transition-colors font-serif text-base ${
                  sortBy === 'alphabetical'
                    ? 'bg-library-gold-100 border-library-gold-300 text-reading-accent'
                    : 'bg-white border-library-sage-200 text-reading-secondary hover:border-library-gold-200'
                }`}
              >
                <ArrowUpDown size={14} />
                {sortBy === 'alphabetical' ? 'A-Z' : 'Recent'}
              </button>

              <button
                onClick={() => setFilterBy(filterBy === 'all' ? 'recent' : 'all')}
                className={`flex items-center gap-1 px-3 py-2 rounded-paper border transition-colors font-serif text-base ${
                  filterBy === 'recent'
                    ? 'bg-library-gold-100 border-library-gold-300 text-reading-accent'
                    : 'bg-white border-library-sage-200 text-reading-secondary hover:border-library-gold-200'
                }`}
              >
                <Filter size={14} />
                {filterBy === 'recent' ? 'Recent' : 'All'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Glossary Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="w-full max-w-none px-4">
          {filteredAndSortedEntries.length === 0 ? (
            <div className="text-center py-12">
              <Book className="mx-auto text-library-sage-400 mb-4" size={48} />
              <h3 className="text-xl font-serif text-reading-secondary mb-2">
                {searchTerm ? 'No matching definitions' : 'No definitions found'}
              </h3>
              <p className="text-reading-muted font-serif">
                {searchTerm 
                  ? 'Try adjusting your search terms or filters.'
                  : 'Definitions will appear here as you interact with the document.'}
              </p>
            </div>
          ) : sortBy === 'alphabetical' ? (
            // Alphabetical grouped view
            <div className="space-y-8">
              {Object.entries(groupedEntries).map(([letter, entries]) => (
                <div key={letter}>
                  <h2 className="text-3xl font-serif text-library-gold-600 mb-4 border-b border-library-sage-200 pb-2">
                    {letter}
                  </h2>
                  <div className="grid gap-4">
                    {entries.map((entry, index) => (
                      <GlossaryCard
                        key={`${entry.blockId}-${entry.textStartOffset}-${index}`}
                        entry={entry}
                        onClick={() => handleTermClick(entry)}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Chronological list view
            <div className="space-y-4">
              {filteredAndSortedEntries.map((entry, index) => (
                <GlossaryCard
                  key={`${entry.blockId}-${entry.textStartOffset}-${index}`}
                  entry={entry}
                  onClick={() => handleTermClick(entry)}
                  formatDate={formatDate}
                  showDate
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Separate component for glossary cards to keep code clean
const GlossaryCard: React.FC<{
  entry: GlossaryEntry;
  onClick: () => void;
  formatDate: (date: string) => string;
  showDate?: boolean;
}> = ({ entry, onClick, formatDate, showDate = false }) => (
  <div
    onClick={onClick}
    className="bg-surface-parchment border border-library-sage-200 rounded-journal p-5 hover:border-library-gold-200 hover:shadow-paper transition-all cursor-pointer group"
  >
    <div className="flex items-start justify-between mb-3">
      <h3 className="text-lg font-serif text-reading-primary group-hover:text-library-gold-600 transition-colors">
        {entry.term}
      </h3>
      <div className="flex items-center gap-2 text-xs text-reading-muted font-serif">
        {showDate && (
          <span>{formatDate(entry.createdAt)}</span>
        )}
        {entry.pageNumber && (
          <span className="bg-library-cream-100 px-2 py-1 rounded-paper">
            Page {entry.pageNumber}
          </span>
        )}
      </div>
    </div>
    
    <p className="text-reading-secondary font-serif leading-relaxed mb-3">
      {entry.definition}
    </p>
    
    <div className="flex items-center gap-2 text-xs text-reading-muted font-serif">
      <span className="bg-library-sage-100 px-2 py-1 rounded-paper">
        {entry.blockType}
      </span>
      <span>•</span>
      <span>Click to view in context</span>
    </div>
  </div>
);

export default GlossaryView;