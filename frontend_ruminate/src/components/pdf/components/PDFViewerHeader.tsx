import React from 'react';
import { useRouter } from 'next/navigation';
import MainConversationButton from '../../chat/MainConversationButton';
import ConversationLibrary from '../../chat/ConversationLibrary';

interface PDFViewerHeaderProps {
  documentTitle: string;
  viewMode: 'pdf' | 'glossary' | 'annotations';
  isViewDropdownOpen: boolean;
  onboardingProps: {
    getHeaderClassName: (base: string) => string;
    getViewDropdownClassName: (base: string) => string;
    getViewDropdownStyle: () => any;
    handleViewDropdownToggle: (e: React.MouseEvent<HTMLButtonElement>, handler: (e: React.MouseEvent<HTMLButtonElement>) => void) => void;
    onboardingState: { isActive: boolean; currentStep: number };
  };
  handleViewDropdownToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  rabbitholeConversations: Array<{
    id: string;
    title: string;
    selectionText: string;
  }>;
  onConversationChange: (id: string | null) => void;
}

export function PDFViewerHeader({
  documentTitle,
  viewMode,
  isViewDropdownOpen,
  onboardingProps,
  handleViewDropdownToggle,
  activeConversationId,
  setActiveConversationId,
  rabbitholeConversations,
  onConversationChange,
}: PDFViewerHeaderProps) {
  const router = useRouter();

  return (
    <div className="relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-library-cream-50 via-surface-parchment to-library-cream-50"></div>
      
      {/* Content */}
      <div className={onboardingProps.getHeaderClassName('relative flex items-center gap-4 px-6 py-4 border-b border-library-sage-200 backdrop-blur-sm')}>
        <button
          onClick={() => router.push('/home')}
          className="group flex items-center gap-2 px-3 py-2 text-reading-secondary hover:text-reading-primary hover:bg-library-cream-100 rounded-book transition-all duration-300 shadow-paper hover:shadow-book"
          title="Return to Library"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-serif font-medium">Library</span>
        </button>
        
        {/* Elegant divider */}
        <div className="w-px h-5 bg-gradient-to-b from-transparent via-library-sage-300 to-transparent opacity-60"></div>
        
        {/* Document title with view mode dropdown */}
        <div className="flex-1 min-w-0 flex items-center gap-6">
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-semibold text-reading-primary truncate tracking-wide">
              {documentTitle || (
                <span className="animate-pulse text-reading-muted">Loading manuscript...</span>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-library-gold-400 opacity-60"></div>
              <span className="text-xs font-sans text-reading-muted uppercase tracking-wider">
                Research Document
              </span>
            </div>
          </div>
          
          {/* View Mode Dropdown */}
          <div className="flex-shrink-0">
            <button 
              onClick={(e) => onboardingProps.handleViewDropdownToggle(e, handleViewDropdownToggle)}
              className={onboardingProps.getViewDropdownClassName('w-32 h-12 flex items-center justify-center rounded-book border shadow-book hover:shadow-shelf transition-all font-serif font-medium')}
              style={{ 
                fontSize: '16px',
                gap: '8px',
                ...onboardingProps.getViewDropdownStyle()
              }}
              data-view-mode-dropdown
            >
              <span>{viewMode === 'pdf' ? 'PDF View' : viewMode === 'glossary' ? 'Glossary' : 'Annotations'}</span>
              <svg className={`w-4 h-4 transition-transform ${isViewDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main Conversation Button */}
        <div className="flex-shrink-0">
          <MainConversationButton
            isActive={activeConversationId === null}
            onConversationChange={setActiveConversationId}
          />
        </div>

        {/* Conversation Library - only show when there are rabbithole conversations */}
        {rabbitholeConversations.length > 0 && (
          <div className="flex-shrink-0">
            <ConversationLibrary
              conversations={rabbitholeConversations.map(conv => ({
                id: conv.id,
                title: conv.title,
                type: 'rabbithole' as const,
                selectionText: conv.selectionText,
                isActive: activeConversationId === conv.id
              }))}
              activeConversationId={activeConversationId}
              onConversationChange={onConversationChange}
              disabled={onboardingProps.onboardingState.isActive && onboardingProps.onboardingState.currentStep === 6}
            />
          </div>
        )}
      </div>
    </div>
  );
}