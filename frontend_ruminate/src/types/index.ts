export interface CachedDocument {
  documentId: string;
  title: string;
  blockConversations: {[blockId: string]: string}; // Keep track of conversations per block if needed later
}

export interface ProcessingProgress {
  status: string;
  detail: string;
}
