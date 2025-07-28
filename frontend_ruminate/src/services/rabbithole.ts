// src/services/rabbithole.ts
import { authenticatedFetch, API_BASE_URL } from "../utils/api";

export interface RabbitholeHighlight {
  id: string;                   // This is the primary ID returned by the backend
  selected_text: string;
  text_start_offset: number;
  text_end_offset: number;
  created_at: string;
  conversation_id?: string;     // Make this optional since the backend doesn't return it
}

export interface CreateRabbitholeRequest {
  document_id: string;
  block_id: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  type: 'rabbithole';
  document_conversation_id?: string; // Optional field for the main document conversation ID
}

// Agent types removed - using unified conversation system for rabbitholes
// Future agent functionality can reuse conversation messaging

export async function createRabbithole(data: CreateRabbitholeRequest): Promise<string> {
  // Use the unified conversation API for rabbithole conversations
  const response = await authenticatedFetch(`${API_BASE_URL}/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'RABBITHOLE',
      document_id: data.document_id,
      source_block_id: data.block_id,
      selected_text: data.selected_text,
      text_start_offset: data.start_offset,
      text_end_offset: data.end_offset
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create rabbithole');
  }

  const result = await response.json();
  return result.conversation_id;
}

export async function getRabbitholesByBlock(blockId: string): Promise<RabbitholeHighlight[]> {
  // Use the unified conversation API to get rabbithole conversations for this block
  const response = await authenticatedFetch(`${API_BASE_URL}/conversations?source_block_id=${blockId}&type=RABBITHOLE`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch rabbitholes');
  }

  const conversations = await response.json();
  
  // Convert conversations to RabbitholeHighlight format
  return conversations.map((conv: any) => ({
    id: conv.id,
    selected_text: conv.selected_text || '',
    text_start_offset: conv.text_start_offset || 0,
    text_end_offset: conv.text_end_offset || 0,
    created_at: conv.created_at,
    conversation_id: conv.id
  }));
}

export async function getRabbitholesByDocument(documentId: string): Promise<RabbitholeHighlight[]> {
  // Use the unified conversation API to get rabbithole conversations for this document
  const response = await authenticatedFetch(`${API_BASE_URL}/conversations?document_id=${documentId}&type=RABBITHOLE`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch rabbitholes');
  }

  const conversations = await response.json();
  
  // Convert conversations to RabbitholeHighlight format
  return conversations.map((conv: any) => ({
    id: conv.id,
    selected_text: conv.selected_text || '',
    text_start_offset: conv.text_start_offset || 0,
    text_end_offset: conv.text_end_offset || 0,
    created_at: conv.created_at,
    conversation_id: conv.id
  }));
}

// Agent-specific functionality removed - rabbitholes now use unified conversation system
// If you need agent functionality in the future, it can be added back as a conversation type