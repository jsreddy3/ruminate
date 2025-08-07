import React, { createContext, useContext, useState, useCallback } from 'react';

interface DefinitionRequest {
  documentId: string;
  blockId: string;
  term: string;
  textStartOffset: number;
  textEndOffset: number;
  position?: { x: number, y: number }; // Store popup position
}

interface DefinitionApprovalContextType {
  setApprovalNeeded: (approvalId: string, request: DefinitionRequest) => void;
  approvalId: string | null;
  pendingRequest: DefinitionRequest | null;
  clearApproval: () => void;
  reopenDefinitionPopup: (definition: string) => void;
  definitionPopupState: {
    isVisible: boolean;
    term: string;
    definition: string;
    position: { x: number, y: number };
    textStartOffset: number;
    textEndOffset: number;
    documentId: string;
    blockId: string;
  } | null;
  closeDefinitionPopup: () => void;
}

const DefinitionApprovalContext = createContext<DefinitionApprovalContextType | null>(null);

export const useDefinitionApproval = () => {
  const context = useContext(DefinitionApprovalContext);
  if (!context) {
    throw new Error('useDefinitionApproval must be used within DefinitionApprovalProvider');
  }
  return context;
};

export const DefinitionApprovalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<DefinitionRequest | null>(null);
  const [definitionPopupState, setDefinitionPopupState] = useState<{
    isVisible: boolean;
    term: string;
    definition: string;
    position: { x: number, y: number };
    textStartOffset: number;
    textEndOffset: number;
    documentId: string;
    blockId: string;
  } | null>(null);

  const setApprovalNeeded = useCallback((approvalId: string, request: DefinitionRequest) => {
    setApprovalId(approvalId);
    setPendingRequest(request);
  }, []);

  const clearApproval = useCallback(() => {
    setApprovalId(null);
    setPendingRequest(null);
  }, []);

  const reopenDefinitionPopup = useCallback((definition: string) => {
    if (pendingRequest) {
      setDefinitionPopupState({
        isVisible: true,
        term: pendingRequest.term,
        definition,
        position: pendingRequest.position || { x: window.innerWidth / 2, y: window.innerHeight / 2 },
        textStartOffset: pendingRequest.textStartOffset,
        textEndOffset: pendingRequest.textEndOffset,
        documentId: pendingRequest.documentId,
        blockId: pendingRequest.blockId,
      });
    }
  }, [pendingRequest]);

  const closeDefinitionPopup = useCallback(() => {
    setDefinitionPopupState(null);
  }, []);

  return (
    <DefinitionApprovalContext.Provider value={{
      setApprovalNeeded,
      approvalId,
      pendingRequest,
      clearApproval,
      reopenDefinitionPopup,
      definitionPopupState,
      closeDefinitionPopup
    }}>
      {children}
    </DefinitionApprovalContext.Provider>
  );
};