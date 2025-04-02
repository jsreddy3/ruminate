import { BlockInsight } from "../../types/insights";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export const insightsApi = {
  // Get insights for a specific block
  getBlockInsight: async (blockId: string, documentId: string): Promise<BlockInsight> => {
    const response = await fetch(`${API_BASE_URL}/insights/block/${blockId}?document_id=${documentId}`);
    if (!response.ok) throw new Error("Failed to fetch block insights");
    return response.json();
  },

  // Get insights for all blocks in a document
  getDocumentInsights: async (documentId: string): Promise<BlockInsight[]> => {
    const response = await fetch(`${API_BASE_URL}/insights/document/${documentId}`);
    if (!response.ok) throw new Error("Failed to fetch document insights");
    return response.json();
  },

  // Analyze a block to generate new insights
  analyzeBlock: async (
    blockId: string,
    pageNumber: number,
    blockContent: string,
    documentId: string
  ): Promise<BlockInsight> => {
    const response = await fetch(`${API_BASE_URL}/insights/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        block_id: blockId,
        page_number: pageNumber,
        block_content: blockContent,
        document_id: documentId
      }),
    });
    if (!response.ok) throw new Error("Failed to analyze block");
    return response.json();
  },

  // Start rumination process for a document
  startRumination: async (documentId: string, objective: string): Promise<{ status: string }> => {
    const response = await fetch(`${API_BASE_URL}/insights/ruminate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        objective,
      }),
    });
    if (!response.ok) throw new Error("Failed to start rumination");
    return response.json();
  },
}; 