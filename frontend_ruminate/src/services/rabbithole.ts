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
  step_type: string;
  content: string;
  step_number: number;
  created_at: string;
  metadata?: any;
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

/**
 * Connect to the agent events stream
 * @param conversationId ID of the agent conversation
 * @returns EventSource instance
 */
export function connectToAgentEvents(conversationId: string): EventSource {
  const eventSourceUrl = `${API_BASE_URL}/agent-rabbitholes/${conversationId}/events`;
  return new EventSource(eventSourceUrl);
}

/**
 * Fetch the steps for a specific agent message
 * @param conversationId ID of the agent conversation
 * @param messageId ID of the message to get steps for
 * @returns Array of agent steps
 */
export async function getAgentSteps(
  conversationId: string, 
  messageId: string
): Promise<AgentStep[]> {
  const response = await fetch(
    `${API_BASE_URL}/agent-rabbitholes/${conversationId}/messages/${messageId}/steps`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch agent steps: ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Create a new agent rabbithole conversation for a block
 * @param documentId ID of the document
 * @param blockId ID of the block
 * @param selectedText Text selected from the block
 * @param startOffset Start position of selection
 * @param endOffset End position of selection
 * @param documentConversationId Optional parent conversation ID
 * @returns ID of the created conversation
 */
export async function createAgentRabbithole(
  documentId: string,
  blockId: string,
  selectedText: string,
  startOffset: number,
  endOffset: number,
  documentConversationId?: string
): Promise<string> {
  const response = await fetch(
    `${API_BASE_URL}/agent-rabbitholes`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_id: documentId,
        block_id: blockId,
        selected_text: selectedText,
        start_offset: startOffset,
        end_offset: endOffset,
        document_conversation_id: documentConversationId
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to create agent rabbithole: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.conversation_id;
}

/**
 * Send a message to an agent rabbithole conversation
 * @param conversationId ID of the agent conversation
 * @param content Message content
 * @param parentId ID of the parent message
 * @returns The created message information
 */
export async function sendAgentMessage(
  conversationId: string,
  content: string,
  parentId: string
): Promise<{ message_id: string; content: string; role: string }> {
  const response = await fetch(
    `${API_BASE_URL}/agent-rabbitholes/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content,
        parent_id: parentId
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to send agent message: ${response.statusText}`);
  }
  
  return response.json();
}