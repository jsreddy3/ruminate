import React, { useMemo, useState } from 'react';
import { FileText, MessageSquare, Search, ArrowUpDown, Filter, Lightbulb } from 'lucide-react';
import { Block } from '../../pdf/PDFViewer';

interface AnnotationEntry {
  id: string;
  text: string;
  note: string;
  textStartOffset: number;
  textEndOffset: number;
  createdAt: string;
  updatedAt: string;
  isGenerated?: boolean;
  sourceConversationId?: string;
  messageCount?: number;
  topic?: string;
  blockId: string;
  blockType: string;
  pageNumber?: number;
  blockIndex: number; // For ordering by block position
}

interface AnnotationsViewProps {
  blocks: Block[];
  onAnnotationClick?: (blockId: string, startOffset: number, endOffset: number) => void;
  className?: string;
}

const AnnotationsView: React.FC<AnnotationsViewProps> = ({
  blocks,
  onAnnotationClick,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'block-order' | 'chronological' | 'type'>('block-order');
  const [filterBy, setFilterBy] = useState<'all' | 'personal' | 'generated'>('all');

  // Extract and aggregate all annotations from block metadata
  const annotationEntries = useMemo(() => {
    const entries: AnnotationEntry[] = [];
    
    blocks.forEach((block, blockIndex) => {
      if (block.metadata?.annotations) {
        Object.entries(block.metadata.annotations).forEach(([key, annotation]) => {
          entries.push({
            id: annotation.id,
            text: annotation.text,
            note: annotation.note,
            textStartOffset: annotation.text_start_offset,
            textEndOffset: annotation.text_end_offset,
            createdAt: annotation.created_at,
            updatedAt: annotation.updated_at,
            isGenerated: (annotation as any).is_generated || false,
            sourceConversationId: (annotation as any).source_conversation_id,
            messageCount: (annotation as any).message_count,
            topic: (annotation as any).topic,
            blockId: block.id,
            blockType: block.block_type,
            pageNumber: block.page_number,
            blockIndex: blockIndex
          });
        });
      }
    });

    return entries;
  }, [blocks]);

  // Filter and sort entries
  const filteredAndSortedEntries = useMemo(() => {
    let filtered = annotationEntries;

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.text.toLowerCase().includes(searchLower) ||
        entry.note.toLowerCase().includes(searchLower) ||
        entry.topic?.toLowerCase().includes(searchLower)
      );
    }

    // Apply type filter
    if (filterBy === 'personal') {
      filtered = filtered.filter(entry => !entry.isGenerated);
    } else if (filterBy === 'generated') {
      filtered = filtered.filter(entry => entry.isGenerated);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'block-order') {
        return a.blockIndex - b.blockIndex;
      } else if (sortBy === 'chronological') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      } else if (sortBy === 'type') {
        // Group by type: personal first, then generated
        if (a.isGenerated !== b.isGenerated) {
          return a.isGenerated ? 1 : -1;
        }
        return a.blockIndex - b.blockIndex;
      }
      return 0;
    });

    return filtered;
  }, [annotationEntries, searchTerm, sortBy, filterBy]);

  const handleAnnotationClick = (entry: AnnotationEntry) => {
    if (onAnnotationClick) {
      onAnnotationClick(entry.blockId, entry.textStartOffset, entry.textEndOffset);
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

  const getSortButtonText = () => {
    switch (sortBy) {
      case 'block-order': return 'Block Order';
      case 'chronological': return 'Recent';
      case 'type': return 'By Type';
      default: return 'Sort';
    }
  };

  const cycleSortMode = () => {
    const modes: typeof sortBy[] = ['block-order', 'chronological', 'type'];
    const currentIndex = modes.indexOf(sortBy);
    const nextIndex = (currentIndex + 1) % modes.length;
    setSortBy(modes[nextIndex]);
  };

  return (
    <div className={`h-full bg-gradient-to-b from-surface-paper to-library-cream-50 ${className}`}>
      {/* Annotations Header */}
      <div className="sticky top-0 z-10 bg-surface-paper/95 backdrop-blur-sm border-b border-library-gold-200 p-6">
        <div className="w-full max-w-none px-4">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="text-library-gold-600" size={28} />
            <h1 className="text-2xl font-serif text-reading-primary">Annotations & Notes</h1>
            <span className="text-sm text-reading-muted font-serif">
              {filteredAndSortedEntries.length} entries
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
                placeholder="Search annotations and notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-4 py-2 border border-library-sage-200 rounded-paper focus:outline-none focus:ring-2 focus:ring-library-gold-400 focus:border-transparent bg-white text-reading-primary font-serif"
                style={{ paddingLeft: '40px' }}
              />
            </div>

            {/* Sort and Filter Controls */}
            <div className="flex gap-2">
              <button
                onClick={cycleSortMode}
                className="flex items-center gap-1 px-3 py-2 rounded-paper border border-library-sage-200 bg-white text-reading-secondary hover:border-library-gold-200 hover:text-reading-primary transition-colors font-serif text-sm"
              >
                <ArrowUpDown size={14} />
                {getSortButtonText()}
              </button>

              <button
                onClick={() => setFilterBy(filterBy === 'all' ? 'personal' : filterBy === 'personal' ? 'generated' : 'all')}
                className={`flex items-center gap-1 px-3 py-2 rounded-paper border transition-colors font-serif text-sm ${
                  filterBy !== 'all'
                    ? 'bg-library-gold-100 border-library-gold-300 text-reading-accent'
                    : 'bg-white border-library-sage-200 text-reading-secondary hover:border-library-gold-200'
                }`}
              >
                <Filter size={14} />
                {filterBy === 'all' ? 'All' : filterBy === 'personal' ? 'Personal' : 'Generated'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Annotations Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="w-full max-w-none px-4">
          {filteredAndSortedEntries.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto text-library-sage-400 mb-4" size={48} />
              <h3 className="text-xl font-serif text-reading-secondary mb-2">
                {searchTerm ? 'No matching annotations' : 'No annotations found'}
              </h3>
              <p className="text-reading-muted font-serif">
                {searchTerm 
                  ? 'Try adjusting your search terms or filters.'
                  : 'Annotations will appear here as you highlight and annotate text in the document.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAndSortedEntries.map((entry, index) => (
                <AnnotationCard
                  key={`${entry.blockId}-${entry.textStartOffset}-${index}`}
                  entry={entry}
                  onClick={() => handleAnnotationClick(entry)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Separate component for annotation cards
const AnnotationCard: React.FC<{
  entry: AnnotationEntry;
  onClick: () => void;
  formatDate: (date: string) => string;
}> = ({ entry, onClick, formatDate }) => (
  <div
    onClick={onClick}
    className="bg-surface-parchment border border-library-sage-200 rounded-journal p-5 hover:border-library-gold-200 hover:shadow-paper transition-all cursor-pointer group"
  >
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        {entry.isGenerated ? (
          <Lightbulb className="text-library-gold-600 flex-shrink-0" size={18} />
        ) : (
          <MessageSquare className="text-library-sage-600 flex-shrink-0" size={18} />
        )}
        <span className={`text-xs px-2 py-1 rounded-paper font-serif ${
          entry.isGenerated 
            ? 'bg-library-gold-100 text-library-gold-800'
            : 'bg-library-sage-100 text-library-sage-800'
        }`}>
          {entry.isGenerated ? 'Generated Note' : 'Personal Annotation'}
        </span>
        {entry.topic && (
          <span className="text-xs bg-library-cream-100 text-reading-muted px-2 py-1 rounded-paper font-serif">
            {entry.topic}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-reading-muted font-serif">
        <span>{formatDate(entry.createdAt)}</span>
        {entry.pageNumber && (
          <span className="bg-library-cream-100 px-2 py-1 rounded-paper">
            Page {entry.pageNumber}
          </span>
        )}
      </div>
    </div>
    
    {/* Selected Text */}
    <div className="mb-3 p-3 bg-library-cream-50 rounded-paper border border-library-cream-200">
      <p className="text-sm font-serif text-reading-secondary italic leading-relaxed">
        "{entry.text}"
      </p>
    </div>
    
    {/* Annotation Note */}
    <p className="text-reading-primary font-serif leading-relaxed mb-3">
      {entry.note}
    </p>
    
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-reading-muted font-serif">
        <span className="bg-library-sage-100 px-2 py-1 rounded-paper">
          {entry.blockType}
        </span>
        {entry.messageCount && (
          <span className="bg-library-cream-100 px-2 py-1 rounded-paper">
            {entry.messageCount} messages
          </span>
        )}
      </div>
      <span className="text-xs text-reading-muted font-serif group-hover:text-reading-secondary transition-colors">
        Click to view in context
      </span>
    </div>
  </div>
);

export default AnnotationsView;