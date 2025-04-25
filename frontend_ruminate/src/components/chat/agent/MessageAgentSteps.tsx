import React, { useState, useEffect } from 'react';
import { agentApi, AgentStep } from '../../../services/api/agent';

interface MessageAgentStepsProps {
  conversationId: string;
  messageId: string;
  isCompleted: boolean;
}

/**
 * Displays agent steps related to a specific message
 * Shows real-time steps and collapses into a toggleable panel when message is completed
 */
const MessageAgentSteps: React.FC<MessageAgentStepsProps> = ({
  conversationId,
  messageId,
  isCompleted
}) => {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!isCompleted); // Auto-expand if not completed

  // Fetch message steps
  useEffect(() => {
    let isMounted = true;
    
    const fetchSteps = async () => {
      try {
        setIsLoading(true);
        const stepsData = await agentApi.getMessageSteps(conversationId, messageId);
        
        if (isMounted) {
          setSteps(stepsData);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error fetching agent steps:', err);
          setError('Failed to load agent steps');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };
    
    fetchSteps();
    
    // Set up polling for updates if the message is not completed
    let intervalId: NodeJS.Timeout | null = null;
    if (!isCompleted) {
      intervalId = setInterval(fetchSteps, 2000); // Poll every 2 seconds
    }
    
    return () => {
      isMounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [conversationId, messageId, isCompleted]);
  
  // Nothing to show
  if (steps.length === 0 && !isLoading) {
    return null;
  }
  
  // Loading indicator while initially loading
  if (isLoading && steps.length === 0) {
    return (
      <div className="mt-2 mb-2 text-xs text-gray-500 flex items-center">
        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
        <span>Loading agent steps...</span>
      </div>
    );
  }
  
  // Display error if any
  if (error && steps.length === 0) {
    return (
      <div className="mt-2 mb-2 text-xs text-red-500">
        {error}
      </div>
    );
  }
  
  // If message is completed and panel is collapsed, show toggle button
  if (isCompleted && !isExpanded) {
    return (
      <div className="mt-2">
        <button 
          onClick={() => setIsExpanded(true)}
          className="text-xs text-gray-500 hover:text-blue-600 flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Show {steps.length} agent steps</span>
        </button>
      </div>
    );
  }
  
  // Steps panel
  return (
    <div className="mt-2 mb-3 text-xs">
      {isCompleted && (
        <div className="flex justify-between items-center mb-1">
          <div className="font-medium text-gray-700 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Agent Steps
          </div>
          <button 
            onClick={() => setIsExpanded(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      
      <div className="space-y-1 max-h-32 overflow-y-auto rounded border border-gray-200">
        {steps.map((step, index) => (
          <AgentStepItem key={step.id || index} step={step} />
        ))}
        
        {/* Show loading indicator if still exploring */}
        {!isCompleted && isLoading && (
          <div className="p-1.5 flex items-center border-t border-gray-100">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse"></div>
            <span className="text-gray-500">Agent is thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface AgentStepItemProps {
  step: AgentStep;
}

/**
 * Renders a single agent step with tool information
 */
const AgentStepItem: React.FC<AgentStepItemProps> = ({ step }) => {
  // Extract tool name if present in step_type
  const toolMatch = step.step_type.match(/tool:(.+)/);
  const toolName = toolMatch ? toolMatch[1].trim() : null;
  
  // Format timestamps
  const formattedTime = new Date(step.created_at).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit'
  });
  
  // Determine icon and style based on step type
  const getStepStyle = () => {
    const baseStyle = "p-1.5 flex items-start border-t border-gray-100 first:border-t-0";
    
    if (step.step_type.startsWith('tool:')) {
      return `${baseStyle} bg-indigo-50`;
    } else if (step.step_type === 'thinking') {
      return `${baseStyle} bg-amber-50`;
    } else if (step.step_type === 'summary') {
      return `${baseStyle} bg-green-50`;
    } else {
      return `${baseStyle} bg-gray-50`;
    }
  };
  
  // Determine icon based on step type
  const getStepIcon = () => {
    if (step.step_type.startsWith('tool:')) {
      return "🔧";
    } else if (step.step_type === 'thinking') {
      return "💭";
    } else if (step.step_type === 'summary') {
      return "📋";
    } else {
      return "•";
    }
  };
  
  return (
    <div className={getStepStyle()}>
      <span className="mr-1.5 flex-shrink-0">{getStepIcon()}</span>
      <div className="flex-grow">
        <div className="flex justify-between items-start">
          <span className="font-medium">
            {toolName ? `${toolName}` : step.step_type}
          </span>
          <span className="text-gray-400 ml-2 flex-shrink-0">{formattedTime}</span>
        </div>
        {step.content && (
          <div className="mt-0.5 text-gray-600 whitespace-pre-wrap break-words">
            {step.content.length > 200 
              ? `${step.content.substring(0, 200)}...` 
              : step.content}
          </div>
        )}
        {step.metadata && Object.keys(step.metadata).length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">Details</summary>
            <pre className="mt-1 p-1 bg-gray-100 rounded text-xs overflow-x-auto">
              {JSON.stringify(step.metadata, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default MessageAgentSteps; 