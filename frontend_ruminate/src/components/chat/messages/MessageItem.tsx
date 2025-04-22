import React, { useState, useEffect } from 'react';
import { MessageNode, MessageRole } from '../../../types/chat';
import { AgentEvent } from '../../../hooks/useAgentEventStream';
import { useMessageSteps } from '../../../hooks/useMessageSteps';

interface MessageItemProps {
  message: MessageNode;
  isActive: boolean;
  versions: MessageNode[];
  isStreaming?: boolean;
  streamingContent?: string | null;
  agentEvents?: AgentEvent[]; // Will be removed/deprecated
  agentStatus?: 'idle' | 'exploring' | 'completed' | 'error';
  conversationId?: string | null; // Added for message steps
  isAgentChat?: boolean; // Added to determine if we should fetch steps
  onSwitchVersion: (messageId: string) => void;
  onEditMessage: (messageId: string, content: string) => Promise<void>;
}

/**
 * Renders a single message with editing and version controls
 */
const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isActive,
  versions,
  isStreaming = false,
  streamingContent = null,
  agentEvents = [], // Will be deprecated
  agentStatus = 'idle',
  conversationId = null,
  isAgentChat = false,
  onSwitchVersion,
  onEditMessage
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isShowingVersions, setIsShowingVersions] = useState(false);
  const [showAgentEvents, setShowAgentEvents] = useState(true);
  
  // Use our new hook to fetch message-specific steps
  const { steps: messageSteps, loading: stepsLoading } = 
    useMessageSteps(
      isAgentChat && message.role === MessageRole.ASSISTANT ? conversationId : null, 
      isAgentChat && message.role === MessageRole.ASSISTANT ? message.id : null
    );
  
  // Determine if this message can be edited (only user messages)
  const canEdit = message.role === MessageRole.USER;
  
  // Determine if this message has multiple versions
  const hasVersions = versions.length > 0;

  // Determine if this message has agent steps or events
  const hasAgentEvents = isStreaming ? 
    (agentEvents.length > 0) : // Use real-time events when streaming
    (messageSteps.length > 0); // Use stored steps for completed messages
  
  // Handle edit submission
  const handleEditSubmit = async () => {
    if (!canEdit || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    
    try {
      await onEditMessage(message.id, editContent);
      setIsEditing(false);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  };

  // Handle role-based styling
  const getRoleStyles = () => {
    switch (message.role) {
      case MessageRole.USER:
        return 'bg-blue-50 border-blue-200';
      case MessageRole.ASSISTANT:
        return 'bg-green-50 border-green-200';
      case MessageRole.SYSTEM:
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-white border-gray-200';
    }
  };

  // When assistant message completes, auto-collapse agent events after a delay
  useEffect(() => {
    if (message.role === MessageRole.ASSISTANT && !isStreaming && message.content && hasAgentEvents) {
      // After the assistant message completes, auto-collapse events after 1 second
      const timer = setTimeout(() => {
        setShowAgentEvents(false);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [message.role, isStreaming, message.content, hasAgentEvents]);

  // Debug logging
  useEffect(() => {
    if (isStreaming && message.role === MessageRole.ASSISTANT) {
      console.log(`Streaming content for ${message.id}:`, streamingContent);
    } else if (!isStreaming && message.role === MessageRole.ASSISTANT) {
      console.log(`Regular content for ${message.id}:`, message.content);
    }
  }, [message.id, message.role, message.content, isStreaming, streamingContent]);

  // Render agent events
  const renderAgentEvents = () => {
    // For streaming messages, show real-time events from the agent stream
    if (isStreaming && message.role === MessageRole.ASSISTANT) {
      if (agentEvents.length === 0) {
        // Show exploring indicator if no events yet but agent is exploring
        if (agentStatus === 'exploring') {
          return (
            <div className="mb-3 px-3 py-2 bg-blue-50 rounded-md border border-blue-100">
              <div className="flex items-center text-sm text-blue-700">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                <span>Agent is exploring...</span>
              </div>
            </div>
          );
        }
        return null;
      }

      return (
        <div className="mb-3 space-y-1.5 border-l-2 border-indigo-200 pl-2 py-1">
          {/* Show events count header */}
          <div className="text-xs font-semibold mb-1 text-indigo-700 ml-1 flex items-center">
            <span className="mr-1">⚙️</span>
            <span>{agentEvents.length} action{agentEvents.length !== 1 ? 's' : ''} taken</span>
          </div>
          
          {agentEvents.map((event, index) => {
            // Determine icon and style based on event type
            let icon = '▶️';
            let bgColor = 'bg-gray-50';
            let textColor = 'text-gray-700';
            
            // Get action name and input for display
            const actionName = event.metadata?.action?.name || '';
            const actionInput = event.metadata?.action?.input || '';
            
            // Create simplified content that only shows the tool name and input
            let displayContent = '';
            if (actionName) {
              displayContent = `Action: ${actionName}`;
              if (actionInput && typeof actionInput === 'string') {
                displayContent += ` Input: ${actionInput.substring(0, 30)}${actionInput.length > 30 ? '...' : ''}`;
              }
            } else {
              displayContent = event.content?.substring(0, 50) || event.type;
              if (event.content && event.content.length > 50) {
                displayContent += '...';
              }
            }
            
            switch (event.type) {
              case 'agent_started':
                icon = '🚀';
                bgColor = 'bg-blue-50';
                textColor = 'text-blue-700';
                break;
              case 'agent_action':
                icon = '🔍';
                bgColor = 'bg-indigo-50';
                textColor = 'text-indigo-700';
                break;
              case 'step.started':
                icon = '⚙️';
                bgColor = 'bg-purple-50';
                textColor = 'text-purple-700';
                break;
              case 'step.completed':
                icon = '✓';
                bgColor = 'bg-green-50';
                textColor = 'text-green-700';
                break;
              case 'agent_completed':
                icon = '🏁';
                bgColor = 'bg-green-50';
                textColor = 'text-green-700';
                break;
              case 'agent_error':
                icon = '❌';
                bgColor = 'bg-red-50';
                textColor = 'text-red-700';
                break;
            }

            return (
              <div 
                key={`event-${event.type}-${index}`}
                className={`px-3 py-1.5 ${bgColor} rounded border-l-2 border-l-${textColor.replace('text-', 'border-')} border-t border-r border-b border-${bgColor.replace('bg-', 'border-')}`}
              >
                <div className={`flex items-center text-sm ${textColor}`}>
                  <span className="mr-2">{icon}</span>
                  <span className="flex-1 font-medium text-xs">{displayContent}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // For completed messages, show stored steps
    if (stepsLoading) {
      // Show loading indicator when steps are being fetched
      return (
        <div className="mb-3 px-3 py-2 bg-gray-50 rounded-md border border-gray-100">
          <div className="flex items-center text-sm text-gray-500">
            <div className="w-2 h-2 bg-gray-400 rounded-full mr-2 animate-pulse"></div>
            <span>Loading agent steps...</span>
          </div>
        </div>
      );
    }
    
    if (messageSteps.length === 0) {
      return null;
    }

    return (
      <div className="mb-3 space-y-1.5 border-l-2 border-indigo-200 pl-2 py-1">
        {/* Show events count header */}
        <div className="text-xs font-semibold mb-1 text-indigo-700 ml-1 flex items-center">
          <span className="mr-1">⚙️</span>
          <span>{messageSteps.length} action{messageSteps.length !== 1 ? 's' : ''} taken</span>
        </div>
        
        {messageSteps.map((step, index) => {
          // Determine icon and style based on step type
          let icon = '▶️';
          let bgColor = 'bg-gray-50';
          let textColor = 'text-gray-700';
          
          // Get simplified content for display
          const actionName = step.metadata?.action?.name || '';
          const actionInput = step.metadata?.action?.input || '';
          
          // Create simplified content that only shows the tool name and input
          let displayContent = '';
          if (actionName) {
            displayContent = `Action: ${actionName}`;
            if (actionInput && typeof actionInput === 'string') {
              displayContent += ` Input: ${actionInput.substring(0, 30)}${actionInput.length > 30 ? '...' : ''}`;
            }
          } else {
            displayContent = step.content?.substring(0, 50) || step.step_type;
            if (step.content && step.content.length > 50) {
              displayContent += '...';
            }
          }
          
          switch (step.step_type) {
            case 'agent_started':
              icon = '🚀';
              bgColor = 'bg-blue-50';
              textColor = 'text-blue-700';
              break;
            case 'agent_action':
              icon = '🔍';
              bgColor = 'bg-indigo-50';
              textColor = 'text-indigo-700';
              break;
            case 'step.started':
              icon = '⚙️';
              bgColor = 'bg-purple-50';
              textColor = 'text-purple-700';
              break;
            case 'step.completed':
              icon = '✓';
              bgColor = 'bg-green-50';
              textColor = 'text-green-700';
              break;
            case 'agent_completed':
              icon = '🏁';
              bgColor = 'bg-green-50';
              textColor = 'text-green-700';
              break;
            case 'agent_error':
              icon = '❌';
              bgColor = 'bg-red-50';
              textColor = 'text-red-700';
              break;
          }

          return (
            <div 
              key={`step-${step.id}-${index}`}
              className={`px-3 py-1.5 ${bgColor} rounded border-l-2 border-l-${textColor.replace('text-', 'border-')} border-t border-r border-b border-${bgColor.replace('bg-', 'border-')}`}
            >
              <div className={`flex items-center text-sm ${textColor}`}>
                <span className="mr-2">{icon}</span>
                <span className="flex-1 font-medium text-xs">{displayContent}</span>
                <span className="text-xs text-gray-500">
                  {new Date(step.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // Helper to determine if this is the latest assistant message
  // Only used for showing "exploring" indicator on the latest message
  const isLatestAssistantMessage = isStreaming && message.role === MessageRole.ASSISTANT;

  return (
    <div className={`flex ${message.role === MessageRole.USER ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`
          max-w-[85%] px-4 py-3 rounded-lg
          ${message.role === MessageRole.USER 
            ? 'bg-primary-50 text-black' 
            : 'bg-gray-100 text-black'}
          ${hasVersions && isActive ? 'border-2 border-primary-300' : ''}
        `}
      >
        {/* Message header */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium text-sm">
            {message.role === MessageRole.USER ? 'You' : 
              message.role === MessageRole.ASSISTANT ? 'AI Assistant' : 'System'}
            {/* Show a small indicator if this is a completed assistant message with agent events */}
            {message.role === MessageRole.ASSISTANT && hasAgentEvents && message.content && !isStreaming && (
              <span className="ml-2 text-xs text-gray-500 cursor-pointer" onClick={() => setShowAgentEvents(!showAgentEvents)}>
                ({showAgentEvents ? 'hide' : 'show'} {messageSteps.length} step{messageSteps.length !== 1 ? 's' : ''})
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Streaming indicator */}
            {isStreaming && message.role === MessageRole.ASSISTANT && (
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-500">Generating</span>
                <span className="inline-block w-1.5 h-1.5 bg-gray-500 rounded-full animate-pulse"></span>
              </div>
            )}
            
            {/* Edit button (for user messages) */}
            {canEdit && !isStreaming && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs text-gray-500 hover:text-blue-600"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            )}
            
            {/* Version selector toggle (if multiple versions exist) */}
            {hasVersions && !isStreaming && (
              <button
                onClick={() => setIsShowingVersions(!isShowingVersions)}
                className="text-xs text-gray-500 hover:text-blue-600"
              >
                {isShowingVersions ? 'Hide Versions' : 'Show Versions'}
              </button>
            )}
            
            {/* Agent events toggle (if events exist and message is completed) */}
            {hasAgentEvents && !isStreaming && message.content && message.role === MessageRole.ASSISTANT && (
              <button
                onClick={() => setShowAgentEvents(!showAgentEvents)}
                className="text-xs text-gray-500 hover:text-blue-600 flex items-center"
              >
                {showAgentEvents ? 'Hide Steps' : 'Show Steps'} 
                <span className="ml-0.5">{showAgentEvents ? '▲' : '▼'}</span>
              </button>
            )}
          </div>
        </div>
        
        {/* Agent Events - show above message content for assistant messages */}
        {message.role === MessageRole.ASSISTANT && showAgentEvents && renderAgentEvents()}
        
        {/* Message content - editable, streaming, or regular read-only */}
        {isEditing ? (
          <div className="mb-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2 text-sm"
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleEditSubmit}
                className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        ) : isStreaming && message.role === MessageRole.ASSISTANT ? (
          <div className="prose prose-sm max-w-none mb-2">
            {streamingContent || "Thinking..."}
          </div>
        ) : (
          <div className="prose prose-sm max-w-none mb-2">
            {message.role === MessageRole.ASSISTANT && !message.content 
              ? "Thinking..." 
              : message.content}
          </div>
        )}
        
        {/* Version selector */}
        {isShowingVersions && hasVersions && !isStreaming && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <div className="text-xs font-medium mb-1">Message Versions:</div>
            <div className="space-y-1">
              {versions.map((version) => (
                <button
                  key={version.id}
                  onClick={() => onSwitchVersion(version.id)}
                  className={`text-xs w-full text-left px-2 py-1 rounded ${
                    version.id === message.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {version.content.substring(0, 50)}
                  {version.content.length > 50 ? '...' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Timestamp */}
        <div className="text-xs text-gray-400 mt-1">
          {new Date(message.created_at).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default MessageItem;