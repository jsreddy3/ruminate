// src/services/rabbithole.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

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
}

export async function createRabbithole(data: CreateRabbitholeRequest): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/rabbitholes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...data,
      type: 'rabbithole'
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
  const response = await fetch(`${API_BASE_URL}/rabbitholes/blocks/${blockId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch rabbitholes');
  }

  return await response.json();
}

export async function getRabbitholesByDocument(documentId: string): Promise<RabbitholeHighlight[]> {
  const response = await fetch(`${API_BASE_URL}/rabbitholes/documents/${documentId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to fetch rabbitholes');
  }

  return await response.json();
}