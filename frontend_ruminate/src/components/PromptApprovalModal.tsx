import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Copy, Edit2 } from 'lucide-react';
import { promptApprovalApi, PromptMessage, PendingPrompt } from '../services/api/promptApproval';

interface PromptApprovalModalProps {
  approvalId: string | null;
  onClose: () => void;
}

export const PromptApprovalModal: React.FC<PromptApprovalModalProps> = ({
  approvalId,
  onClose
}) => {
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<PromptMessage[]>([]);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (approvalId) {
      fetchPendingPrompt();
    }
  }, [approvalId]);

  const fetchPendingPrompt = async () => {
    if (!approvalId) return;
    
    try {
      setLoading(true);
      const data = await promptApprovalApi.getPendingPrompt(approvalId);
      setPendingPrompt(data);
      setEditedPrompt([...data.prompt]);
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
      await promptApprovalApi.approve(
        approvalId,
        modified ? editedPrompt : undefined
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
      await promptApprovalApi.reject(approvalId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleMessageEdit = (index: number, newContent: string) => {
    const newPrompt = [...editedPrompt];
    newPrompt[index] = { ...newPrompt[index], content: newContent };
    setEditedPrompt(newPrompt);
  };

  const hasModifications = () => {
    if (!pendingPrompt) return false;
    return JSON.stringify(pendingPrompt.prompt) !== JSON.stringify(editedPrompt);
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  if (!approvalId || !pendingPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Prompt Approval Required</h2>
            <p className="text-sm text-gray-500">
              Review and approve the prompt before sending to LLM
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
            <span className="text-gray-600">
              Messages: <span className="font-medium">{pendingPrompt.metadata.original_message_count}</span>
            </span>
            <span className="text-gray-600">
              Characters: <span className="font-medium">{pendingPrompt.metadata.total_chars}</span>
            </span>
            {hasModifications() && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                Modified
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {editedPrompt.map((message, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-1 rounded ${
                    message.role === 'system' ? 'bg-purple-100 text-purple-700' :
                    message.role === 'user' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {message.role.toUpperCase()}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Copy content"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setSelectedMessageIndex(
                        selectedMessageIndex === index ? null : index
                      )}
                      className="text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span className="text-xs">{selectedMessageIndex === index ? "Done" : "Edit"}</span>
                    </button>
                  </div>
                </div>
                
                {selectedMessageIndex === index ? (
                  <textarea
                    value={message.content}
                    onChange={(e) => handleMessageEdit(index, e.target.value)}
                    className={`w-full p-3 border rounded-md font-mono text-sm ${
                      message.role === 'system' ? 'min-h-[400px]' : 'min-h-[100px]'
                    }`}
                    autoFocus
                  />
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-3 rounded overflow-x-auto max-h-[400px] overflow-y-auto">
                    {message.content}
                  </pre>
                )}
              </div>
            ))}
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