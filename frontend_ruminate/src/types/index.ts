export interface CachedDocument {
  documentId: string;
  title: string;
  blockConversations?: { [blockId: string]: string[] };
}

export interface ProcessingProgress {
  status: string;
  detail?: string;
  message?: string;
  error?: string;
  document_id?: string;
  event_type?: string;
  progress?: number;
}

export interface DocumentProcessingEvent {
  event_type: string;
  status: string;
  document_id: string;
  message?: string;
  error?: string;
  timestamp: string;
}

export type DocumentStatus = 
  | 'PENDING'
  | 'PROCESSING_MARKER'
  | 'ANALYZING_CONTENT'
  | 'ANALYSIS_COMPLETE'
  | 'ANALYSIS_WARNING'
  | 'READY'
  | 'ERROR'
  | 'UPLOADING'
  | 'INITIALIZING'
  | 'CACHE_CHECK'
  | 'CACHE_HIT'
  | 'CACHE_MISS'
  | 'CACHE_INFO'
  | 'CACHE_ERROR'
  | 'PROCESSING_START';
