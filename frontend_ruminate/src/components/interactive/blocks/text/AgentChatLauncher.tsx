import React, { useState } from 'react';
import { agentApi } from '../../../../services/api/agent';

interface AgentChatLauncherProps {
  documentId: string;
  blockId: string;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  onLaunchComplete?: (conversationId: string, selectedText: string) => void;
  onCancel?: () => void;
}

/**
 * Component that appears after text selection to launch an agent chat
 * about specific content within a block
 */
const AgentChatLauncher: React.FC<AgentChatLauncherProps> = ({
  documentId,
  blockId,
  selectedText,
  startOffset,
  endOffset,
  onLaunchComplete,
  onCancel
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Function to create and navigate to an agent chat
  const launchAgentChat = async () => {
    setIsCreating(true);
    setError(null);
    
    try {
      // Create a new agent rabbithole conversation from the selected text
      const result = await agentApi.createAgentRabbithole(
        documentId,
        blockId,
        selectedText,
        startOffset,
        endOffset
      );
      
      // Extract conversation_id from the result
      const conversationId = result.conversation_id;
      
      // Notify parent component if callback provided
      if (onLaunchComplete) {
        onLaunchComplete(conversationId, selectedText);
      }
      
      // Note: removed the auto-navigation to allow parent component to decide what to do
      // This is better for the tabbed interface we're implementing
    } catch (err) {
      console.error('Error creating agent chat:', err);
      setError('Failed to create agent chat. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow-lg border border-indigo-200 p-4 max-w-md">
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Launch AI Agent
      </h3>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          Create an agent chat focused on exploring this content:
        </p>
        <div className="bg-indigo-50 p-3 rounded text-gray-800 text-sm border border-indigo-100">
          {selectedText.length > 150 
            ? `${selectedText.substring(0, 150)}...` 
            : selectedText}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}
      
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
          disabled={isCreating}
        >
          Cancel
        </button>
        <button
          onClick={launchAgentChat}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-300"
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Launch Agent'}
        </button>
      </div>
    </div>
  );
};

export default AgentChatLauncher; 