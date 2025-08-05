import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Block } from '../pdf/PDFViewer';
import { useMessageTree } from '../../hooks/useMessageTree';
import { useMessageStreamHandler } from '../../hooks/useMessageStreamHandler';
import { useNoteGeneration } from '../../hooks/useNoteGeneration';
import { MessageRole } from '../../types/chat';

// Import components
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import NoteGenerationPopup from './NoteGenerationPopup';

interface ChatContainerProps {
  documentId: string;
  selectedBlock?: Block | null;
  conversationId: string; // Make required since PDFViewer always provides it
  conversationType?: 'main' | 'rabbithole';
  rabbitholeMetadata?: {
    source_block_id: string;
    selected_text: string;
  };
  onClose?: () => void;
  pendingText?: string;
  onTextAdded?: () => void;
  onRequestBlockSelection?: (config: {
    prompt: string;
    onComplete: (blockId: string) => void;
  }) => void;
  onUpdateBlockMetadata?: (blockId: string, newMetadata: any) => void;
  onBlockMetadataUpdate?: () => void;
  onOpenBlockWithNote?: (blockId: string, noteId: string) => void;
  getBlockMetadata?: (blockId: string) => any;
  currentPage?: number;
  blocks?: Block[];
}

const ChatContainer: React.FC<ChatContainerProps> = ({
  documentId,
  selectedBlock = null,
  conversationId: initialConversationId,
  conversationType = 'main',
  rabbitholeMetadata,
  onClose,
  pendingText,
  onTextAdded,
  onRequestBlockSelection,
  onUpdateBlockMetadata,
  onBlockMetadataUpdate,
  onOpenBlockWithNote,
  getBlockMetadata,
  currentPage = 1,
  blocks = []
}) => {
  // Track conversation ID (may need to be created)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId || null);
  
  // Zoom state - scholarly zoom levels
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isZoomCollapsed, setIsZoomCollapsed] = useState(true); // Start collapsed
  const containerRef = useRef<HTMLDivElement>(null);
  
  const zoomPresets = [
    { level: 0.9, label: 'Small', percentage: '90%' },
    { level: 1, label: 'Standard', percentage: '100%' },
    { level: 1.1, label: 'Large', percentage: '110%' }
  ];
  
  // Core message tree state for the conversation
  const {
    messageTree,
    activeThreadIds,
    isLoading: isLoadingTree,
    sendMessage,
    editMessage,
    switchToVersion,
    refreshTree,
    addSummaryToMessage
  } = useMessageTree({
    conversationId,
    selectedBlockId: selectedBlock?.id,
    currentPage,
    blocks
  });
  
  // Message streaming handler
  const {
    streamingMessageId,
    streamingContent,
    webSearchEvent,
    startStreaming
  } = useMessageStreamHandler({
    conversationId,
    onStreamComplete: refreshTree
  });

  // Note generation handler
  const {
    showNotePopup,
    setShowNotePopup,
    isGeneratingNote,
    noteGenerationStatus,
    handleGenerateNote
  } = useNoteGeneration({
    conversationId,
    conversationType,
    rabbitholeMetadata,
    onRequestBlockSelection,
    onUpdateBlockMetadata,
    onBlockMetadataUpdate,
    onOpenBlockWithNote,
    getBlockMetadata,
    onSummaryGenerated: (_messageId, summary) => addSummaryToMessage(summary)
  });
  
  // Set conversation ID from parent immediately (no initialization logic)
  useEffect(() => {
    if (initialConversationId !== conversationId) {
      setConversationId(initialConversationId);
    }
  }, [initialConversationId, conversationId]);
  
  // Handle sending a new message
  const handleSendMessage = useCallback(async (content: string) => {
    if (!conversationId) return;
    
    try {
      // Find the parent message ID (last message in active thread or system message)
      const parentId = activeThreadIds.length > 0 
        ? activeThreadIds[activeThreadIds.length - 1] 
        : messageTree.find(msg => msg.role === MessageRole.SYSTEM)?.id || '';
      
      if (!parentId) {
        console.error('No valid parent message found');
        return;
      }
      
      // Send message and get response ID for streaming
      const [, responseMessageId] = await sendMessage(content, parentId);
      
      // Set up token streaming
      startStreaming(responseMessageId);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [conversationId, activeThreadIds, messageTree, sendMessage, startStreaming]);
  
  // Handle editing a message
  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    if (!conversationId) return;
    
    try {
      // Edit message and get response ID for streaming
      const [_, responseMessageId] = await editMessage(messageId, content);
      
      // Set up token streaming for edited message
      startStreaming(responseMessageId);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }, [conversationId, editMessage, startStreaming]);

  // Handle keyboard shortcuts for zoom
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey)) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoomLevel(prev => Math.min(1.5, prev + 0.1));
        } else if (e.key === '-') {
          e.preventDefault();
          setZoomLevel(prev => Math.max(0.5, prev - 0.1));
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(1);
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyboard);
      return () => container.removeEventListener('keydown', handleKeyboard);
    }
  }, []);
  
  // Count total messages for pill visibility (exclude system messages)
  // Use activeThreadIds length instead of messageTree since tree building has issues
  const totalMessageCount = Math.max(0, activeThreadIds.length - 1); // -1 to exclude system message
  const shouldShowNotePill = totalMessageCount >= 4;
  
  
  
  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full bg-gradient-to-b from-surface-parchment via-library-cream-50 to-surface-paper text-reading-primary relative"
      tabIndex={-1}
    >
      {/* Subtle notebook margin line */}
      <div className="absolute left-8 top-0 bottom-0 w-px bg-library-mahogany-200 opacity-30"></div>
      
      {/* Collapsible zoom controls - like a magnifying glass over ancient texts */}
      <div className="absolute top-4 right-4 z-10 flex items-center">
        {/* Collapsed toggle button */}
        {isZoomCollapsed ? (
          <button
            onClick={() => setIsZoomCollapsed(false)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-parchment/95 backdrop-blur-sm border border-library-gold-200 rounded-book shadow-paper hover:shadow-book transition-all duration-200"
            title="Show zoom controls"
          >
            <svg className="w-4 h-4 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-serif text-library-mahogany-600">{Math.round(zoomLevel * 100)}%</span>
          </button>
        ) : (
          /* Expanded controls */
          <div className="flex items-center gap-2 px-3 py-2 bg-surface-parchment/95 backdrop-blur-sm border border-library-gold-200 rounded-book shadow-paper">
            <button
              onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))}
              className="p-1.5 hover:bg-library-cream-100 rounded transition-colors"
              title="Zoom out (Cmd/Ctrl -)"
            >
              <svg className="w-4 h-4 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 12H4" />
              </svg>
            </button>
            
            <div className="flex items-center gap-1">
              {zoomPresets.map((preset) => (
                <button
                  key={preset.level}
                  onClick={() => setZoomLevel(preset.level)}
                  className={`px-2 py-1 text-sm font-serif transition-all ${
                    zoomLevel === preset.level
                      ? 'text-library-mahogany-700 bg-library-gold-100 border-b-2 border-library-gold-400'
                      : 'text-library-mahogany-500 hover:text-library-mahogany-700 hover:bg-library-cream-100'
                  }`}
                  title={`${preset.label} (${preset.percentage})`}
                >
                  {preset.percentage}
                </button>
              ))}
            </div>
            
            <button
              onClick={() => setZoomLevel(prev => Math.min(1.5, prev + 0.1))}
              className="p-1.5 hover:bg-library-cream-100 rounded transition-colors"
              title="Zoom in (Cmd/Ctrl +)"
            >
              <svg className="w-4 h-4 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            
            <div className="w-px h-6 bg-library-gold-300 mx-1"></div>
            
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1.5 hover:bg-library-cream-100 rounded transition-colors"
              title="Reset zoom (Cmd/Ctrl 0)"
            >
              <svg className="w-4 h-4 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            
            {/* Collapse button */}
            <button
              onClick={() => setIsZoomCollapsed(true)}
              className="p-1.5 hover:bg-library-cream-100 rounded transition-colors ml-1"
              title="Hide zoom controls"
            >
              <svg className="w-4 h-4 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {/* Content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatMessages
          messageTree={messageTree}
          activeThreadIds={activeThreadIds}
          streamingMessageId={streamingMessageId}
          streamingContent={streamingContent}
          webSearchEvent={webSearchEvent}
          conversationId={conversationId}
          onSwitchVersion={switchToVersion}
          onEditMessage={handleEditMessage}
          documentId={documentId}
          zoomLevel={zoomLevel}
          conversationType={conversationType}
          selectedText={rabbitholeMetadata?.selected_text}
        />
        
        {/* Scholarly note generation prompt */}
        {shouldShowNotePill && (
          <div className="px-6 py-3 flex justify-center">
            <button
              onClick={() => setShowNotePopup(true)}
              className="group flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-library-gold-50 to-library-cream-100 hover:from-library-gold-100 hover:to-library-cream-200 text-reading-accent border border-library-gold-200 rounded-book transition-all duration-300 shadow-paper hover:shadow-book"
              disabled={isLoadingTree || !!streamingMessageId || isGeneratingNote}
            >
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-serif text-sm font-medium">Save Conversation Insights</span>
            </button>
          </div>
        )}

        {/* Elegant note generation status indicator */}
        {isGeneratingNote && noteGenerationStatus && (
          <div className="px-6 py-3 flex justify-center">
            <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-surface-parchment to-library-cream-100 border border-library-sage-200 rounded-journal shadow-paper backdrop-blur-sm">
              {noteGenerationStatus.includes('Failed') ? (
                <svg className="w-5 h-5 text-library-mahogany-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : noteGenerationStatus.includes('successfully') ? (
                <svg className="w-5 h-5 text-library-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 animate-spin text-library-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span className={`font-serif text-sm ${
                noteGenerationStatus.includes('Failed') 
                  ? 'text-library-mahogany-700' 
                  : noteGenerationStatus.includes('successfully') 
                    ? 'text-library-forest-700' 
                    : 'text-library-gold-700'
              }`}>
                {noteGenerationStatus}
              </span>
            </div>
          </div>
        )}
        
        <ChatInput
          onSendMessage={handleSendMessage}
          isDisabled={isLoadingTree || !!streamingMessageId}
          pendingText={pendingText}
          onTextConsumed={onTextAdded}
        />
      </div>

      {/* Note Generation Popup */}
      <NoteGenerationPopup
        isVisible={showNotePopup}
        totalMessages={totalMessageCount}
        onClose={() => setShowNotePopup(false)}
        onGenerate={handleGenerateNote}
      />
    </div>
  );
};

export default ChatContainer; 