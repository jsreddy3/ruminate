import React, { createContext, useContext, useState, useCallback } from 'react';

interface DefinitionApprovalContextType {
  setApprovalNeeded: (approvalId: string, request: any) => void;
  approvalId: string | null;
  pendingRequest: any | null;
  clearApproval: () => void;
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
  const [pendingRequest, setPendingRequest] = useState<any>(null);

  const setApprovalNeeded = useCallback((approvalId: string, request: any) => {
    setApprovalId(approvalId);
    setPendingRequest(request);
  }, []);

  const clearApproval = useCallback(() => {
    setApprovalId(null);
    setPendingRequest(null);
  }, []);

  return (
    <DefinitionApprovalContext.Provider value={{
      setApprovalNeeded,
      approvalId,
      pendingRequest,
      clearApproval
    }}>
      {children}
    </DefinitionApprovalContext.Provider>
  );
};