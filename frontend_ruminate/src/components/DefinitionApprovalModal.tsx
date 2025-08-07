import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Copy, Edit2, FileText, Hash } from 'lucide-react';
import { definitionApprovalApi, PendingDefinition } from '../services/api/definitionApproval';

interface DefinitionApprovalModalProps {
  approvalId: string | null;
  onClose: () => void;
}

export const DefinitionApprovalModal: React.FC<DefinitionApprovalModalProps> = ({
  approvalId,
  onClose
}) => {
  const [pendingDefinition, setPendingDefinition] = useState<PendingDefinition | null>(null);
  const [editedSystemPrompt, setEditedSystemPrompt] = useState<string>('');
  const [editedUserPrompt, setEditedUserPrompt] = useState<string>('');
  const [editingPrompt, setEditingPrompt] = useState<'system' | 'user' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (approvalId) {
      fetchPendingDefinition();
    }
  }, [approvalId]);

  const fetchPendingDefinition = async () => {
    if (!approvalId) return;
    
    try {
      setLoading(true);
      const data = await definitionApprovalApi.getPendingDefinition(approvalId);
      setPendingDefinition(data);
      setEditedSystemPrompt(data.system_prompt);
      setEditedUserPrompt(data.user_prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (modified: boolean = false) => {
    if (!approvalId) return;
    
    try {
      setLoading(true);
      await definitionApprovalApi.approve(
        approvalId,
        modified ? editedSystemPrompt : undefined,
        modified ? editedUserPrompt : undefined
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!approvalId) return;
    
    try {
      setLoading(true);
      await definitionApprovalApi.reject(approvalId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const hasModifications = () => {
    if (!pendingDefinition) return false;
    return pendingDefinition.system_prompt !== editedSystemPrompt || 
           pendingDefinition.user_prompt !== editedUserPrompt;
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  if (!approvalId || !pendingDefinition) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Definition Approval Required</h2>
            <p className="text-sm text-gray-500">
              Review and approve the definition generation for: <span className="font-medium">"{pendingDefinition.term}"</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        {/* Metadata */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-6 text-sm">
            <span className="text-gray-600 flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Document: <span className="font-medium">{pendingDefinition.metadata.document_title || 'Untitled'}</span>
            </span>
            <span className="text-gray-600 flex items-center gap-1">
              <Hash className="w-4 h-4" />
              Offsets: <span className="font-medium">{pendingDefinition.metadata.text_start_offset}-{pendingDefinition.metadata.text_end_offset}</span>
            </span>
            {hasModifications() && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                Modified
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {/* Context Preview */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                  DOCUMENT CONTEXT
                </span>
                <button
                  onClick={() => copyToClipboard(pendingDefinition.full_context)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Copy context"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-3 rounded overflow-x-auto max-h-[150px] overflow-y-auto">
                {pendingDefinition.full_context}
              </pre>
            </div>

            {/* System Prompt */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium px-2 py-1 rounded bg-purple-100 text-purple-700">
                  SYSTEM PROMPT
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(editedSystemPrompt)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy prompt"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingPrompt(editingPrompt === 'system' ? null : 'system')}
                    className="text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="text-xs">{editingPrompt === 'system' ? "Done" : "Edit"}</span>
                  </button>
                </div>
              </div>
              
              {editingPrompt === 'system' ? (
                <textarea
                  value={editedSystemPrompt}
                  onChange={(e) => setEditedSystemPrompt(e.target.value)}
                  className="w-full p-3 border rounded-md font-mono text-sm min-h-[150px]"
                  autoFocus
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-3 rounded overflow-x-auto max-h-[150px] overflow-y-auto">
                  {editedSystemPrompt}
                </pre>
              )}
            </div>

            {/* User Prompt */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-700">
                  USER PROMPT
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(editedUserPrompt)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy prompt"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setEditingPrompt(editingPrompt === 'user' ? null : 'user')}
                    className="text-gray-400 hover:text-gray-600 flex items-center gap-1"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="text-xs">{editingPrompt === 'user' ? "Done" : "Edit"}</span>
                  </button>
                </div>
              </div>
              
              {editingPrompt === 'user' ? (
                <textarea
                  value={editedUserPrompt}
                  onChange={(e) => setEditedUserPrompt(e.target.value)}
                  className="w-full p-3 border rounded-md font-mono text-sm min-h-[100px]"
                  autoFocus
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-3 rounded overflow-x-auto max-h-[100px] overflow-y-auto">
                  {editedUserPrompt}
                </pre>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex justify-between">
          <button
            onClick={handleReject}
            disabled={loading}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            Reject
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => handleApprove(false)}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
            >
              Approve Original
            </button>
            <button
              onClick={() => handleApprove(true)}
              disabled={loading || !hasModifications()}
              className={`px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${
                hasModifications() 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-4 h-4" />
              Approve with Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};