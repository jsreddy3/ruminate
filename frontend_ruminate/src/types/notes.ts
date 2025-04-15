export interface Notes {
  id: string;
  document_id: string;
  block_id: string;
  content: string;
  conversation_id?: string;
  message_id?: string;
  block_sequence_no?: number;
  meta_data?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
