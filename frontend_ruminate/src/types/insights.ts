export interface Annotation {
  phrase: string;
  insight: string;
}

export interface BlockInsight {
  block_id: string;
  page_number: number;
  insight: string;
  annotations: Annotation[];
  conversation_history: Array<{
    role: string;
    content: string;
  }>;
} 