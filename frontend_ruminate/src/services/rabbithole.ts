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
  document_conversation_id?: string; // Optional field for the main document conversation ID
}

export type AgentEventType = 
  | 'agent_started'
  | 'agent_action'
  | 'agent_answer'
  | 'agent_timeout'
  | 'agent_error'
  | 'agent_completed';

export interface AgentEvent {
  type: AgentEventType;
  action?: string;
  input?: string;
  result_preview?: string;
  message?: string;
  timestamp: number;
}

export type AgentStepType = 'thought' | 'action' | 'result' | 'error' | 'timeout';

export interface AgentStep {
  id: string;
  step_type: AgentStepType;
  content: string;
  step_number: number;
  created_at: string;
  metadata?: any;
}

export interface EditMessageResponse {
  edited_message_id: string;
  placeholder_id:     string;
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

// Add new function to create agent rabbitholes
export async function createAgentRabbithole(data: CreateRabbitholeRequest): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/agent-rabbitholes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create agent rabbithole');
  }
  
  const result = await response.json();
  return result.conversation_id;
}

export async function sendAgentMessage(
  conversationId: string,
  content: string,
  parentId: string
): Promise<{ message_id: string; content: string; role: string }> {
  const response = await fetch(`${API_BASE_URL}/agent-rabbitholes/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      parent_id: parentId
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to send message to agent');
  }
  
  return await response.json();
}

// Connect to SSE for real-time events
export function connectToAgentEvents(conversationId: string): EventSource {
  return new EventSource(`${API_BASE_URL}/agent-rabbitholes/${conversationId}/events`);
}

// Fetch stored agent process steps for a message
export async function getAgentSteps(conversationId: string, messageId: string): Promise<AgentStep[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/agent-rabbitholes/${conversationId}/messages/${messageId}/steps`);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to fetch agent steps');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching agent steps:', error);
    return []; // Return empty array on error
  }
}

export async function editAgentMessage(
  conversationId: string,
  messageId: string,
  parentId: string,          // ← new arg
  newContent: string,
) {
  const res = await fetch(
    `${API_BASE_URL}/agent-rabbitholes/${conversationId}/messages/${messageId}/edit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent, parent_id: parentId }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as EditMessageResponse;
}
