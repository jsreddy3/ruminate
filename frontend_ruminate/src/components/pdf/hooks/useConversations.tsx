import { useState, useCallback, useEffect, useRef } from 'react';
import { authenticatedFetch, API_BASE_URL } from '../../../utils/api';
import { createRabbithole } from '../../../services/rabbithole';

interface RabbitholeConversation {
  id: string;
  title: string;
  selectionText: string;
  blockId: string;
}

interface RabbitholeData {
  id: string;
  type: string;
  source_block_id: string;
  selected_text?: string;
  text_start_offset?: number;
  text_end_offset?: number;
  created_at: string;
  updated_at: string;
}

interface UseConversationsProps {
  documentId: string;
  mainConversationId?: string | null;
  onActiveConversationChange?: (conversationId: string | null) => void;
}

interface UseConversationsReturn {
  // State
  activeConversationId: string | null;
  rabbitholeConversations: RabbitholeConversation[];
  rabbitholeData: RabbitholeData[];
  
  // Actions
  setActiveConversationId: (id: string | null) => void;
  setRabbitholeConversations: React.Dispatch<React.SetStateAction<RabbitholeConversation[]>>;
  createRabbitholeConversation: (blockId: string, selectedText: string, startOffset: number, endOffset: number) => Promise<string>;
  handleRabbitholeCreated: (conversationId: string, selectedText: string, blockId: string) => void;
  addRabbitholeConversation: (blockId: string, conversationId: string, selectedText: string, startOffset: number, endOffset: number) => void;
  getRabbitholeHighlightsForBlock: (blockId: string) => any[];
  switchToMainConversation: () => void;
  switchToRabbithole: (rabbitholeId: string) => void;
}

export function useConversations({
  documentId,
  mainConversationId,
  onActiveConversationChange
}: UseConversationsProps): UseConversationsReturn {
  // Conversation state
  const [activeConversationId, setActiveConversationIdInternal] = useState<string | null>(null);
  const [rabbitholeConversations, setRabbitholeConversations] = useState<RabbitholeConversation[]>([]);
  const [rabbitholeData, setRabbitholeData] = useState<RabbitholeData[]>([]);
  
  // Set active conversation with callback
  const setActiveConversationId = useCallback((id: string | null) => {
    setActiveConversationIdInternal(id);
    onActiveConversationChange?.(id);
  }, [onActiveConversationChange]);
  
  // Fetch rabbithole data for the document
  useEffect(() => {
    if (!documentId) return;
    
    const fetchRabbitholeData = async () => {
      try {
        const rabbitholeResponse = await authenticatedFetch(
          `${API_BASE_URL}/conversations?document_id=${documentId}&type=RABBITHOLE`
        );
        if (rabbitholeResponse.ok) {
          const rabbitholeConvos = await rabbitholeResponse.json();
          setRabbitholeData(rabbitholeConvos || []);
        }
      } catch (error) {
        console.error('Error fetching rabbithole data:', error);
      }
    };
    
    fetchRabbitholeData();
  }, [documentId]);
  
  // Transform fetched rabbithole data into conversation tabs format
  useEffect(() => {
    if (!rabbitholeData || rabbitholeData.length === 0) return;

    const transformedConversations = rabbitholeData.map(rabbithole => ({
      id: rabbithole.id,
      title: rabbithole.selected_text 
        ? (rabbithole.selected_text.length > 30 
            ? rabbithole.selected_text.substring(0, 30) + '...' 
            : rabbithole.selected_text)
        : 'Rabbithole Discussion',
      selectionText: rabbithole.selected_text || '',
      blockId: rabbithole.source_block_id || ''
    }));

    setRabbitholeConversations(transformedConversations);
  }, [rabbitholeData]);
  
  // Create a new rabbithole conversation
  const createRabbitholeConversation = useCallback(async (
    blockId: string,
    selectedText: string,
    startOffset: number,
    endOffset: number
  ): Promise<string> => {
    if (!documentId) {
      throw new Error('Document ID is required to create rabbithole');
    }
    
    const conversationId = await createRabbithole({
      document_id: documentId,
      block_id: blockId,
      selected_text: selectedText,
      start_offset: startOffset,
      end_offset: endOffset,
      type: 'rabbithole'
    });
    
    handleRabbitholeCreated(conversationId, selectedText, blockId);
    return conversationId;
  }, [documentId]);
  
  // Handle rabbithole creation (when created elsewhere)
  const handleRabbitholeCreated = useCallback((
    conversationId: string,
    selectedText: string,
    blockId: string
  ) => {
    if (!conversationId) {
      console.error("Cannot create rabbithole conversation without a conversation ID");
      return;
    }

    const title = selectedText && selectedText.length > 30 
      ? `${selectedText.substring(0, 30)}...` 
      : selectedText || "New Rabbithole Chat";
    
    // Check if we already have this conversation to prevent duplicates
    const existingConversation = rabbitholeConversations.find(c => c.id === conversationId);
    if (existingConversation) {
      setActiveConversationId(conversationId);
      return;
    }
    
    // Add this conversation to our list
    setRabbitholeConversations(prev => [
      ...prev, 
      {
        id: conversationId,
        title,
        selectionText: selectedText || "",
        blockId
      }
    ]);
    
    // Set this as the active conversation
    setActiveConversationId(conversationId);
  }, [rabbitholeConversations, setActiveConversationId]);
  
  // Add rabbithole conversation to data (optimistic update)
  const addRabbitholeConversation = useCallback((
    blockId: string,
    conversationId: string,
    selectedText: string,
    startOffset: number,
    endOffset: number
  ) => {
    const newConversation: RabbitholeData = {
      id: conversationId,
      type: 'RABBITHOLE',
      source_block_id: blockId,
      selected_text: selectedText,
      text_start_offset: startOffset,
      text_end_offset: endOffset,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    setRabbitholeData(prevConversations => [...prevConversations, newConversation]);
  }, []);
  
  // Get rabbithole highlights for a specific block
  const getRabbitholeHighlightsForBlock = useCallback((blockId: string) => {
    return rabbitholeData
      .filter(conv => conv.source_block_id === blockId)
      .map(conv => ({
        id: conv.id,
        selected_text: conv.selected_text || '',
        text_start_offset: conv.text_start_offset || 0,
        text_end_offset: conv.text_end_offset || 0,
        created_at: conv.created_at,
        conversation_id: conv.id
      }));
  }, [rabbitholeData]);
  
  // Convenience methods for switching conversations
  const switchToMainConversation = useCallback(() => {
    setActiveConversationId(null);
  }, [setActiveConversationId]);
  
  const switchToRabbithole = useCallback((rabbitholeId: string) => {
    setActiveConversationId(rabbitholeId);
  }, [setActiveConversationId]);
  
  return {
    // State
    activeConversationId,
    rabbitholeConversations,
    rabbitholeData,
    
    // Actions
    setActiveConversationId,
    setRabbitholeConversations,
    createRabbitholeConversation,
    handleRabbitholeCreated,
    addRabbitholeConversation,
    getRabbitholeHighlightsForBlock,
    switchToMainConversation,
    switchToRabbithole,
  };
}