import React, { useState } from 'react';
import { AgentEvent, AgentStatus } from '../../../hooks/useAgentEventStream';

interface AgentEventViewerProps {
  events: AgentEvent[];
  status: AgentStatus;
  conversationId: string;
}

/**
 * Displays real-time agent events and steps
 */
const AgentEventViewer: React.FC<AgentEventViewerProps> = ({ events, status, conversationId }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  
  // If there are no events yet, show a loading state
  if (events.length === 0) {
    return (
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
          <span className="text-sm text-gray-600">
            {status === 'idle' ? 'Waiting to start...' : 'Agent is preparing...'}
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="border-t border-gray-200">
      {/* Header with toggle */}
      <div 
        className="p-3 bg-gray-50 flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-medium text-sm flex items-center">
          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
            status === 'exploring' ? 'bg-blue-500 animate-pulse' :
            status === 'completed' ? 'bg-green-500' :
            status === 'error' ? 'bg-red-500' : 'bg-gray-400'
          }`}></span>
          Agent {
            status === 'exploring' ? 'Exploring' :
            status === 'completed' ? 'Complete' :
            status === 'error' ? 'Error' : 'Status'
          }
        </div>
        <div className="text-gray-500">
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>
      
      {/* Event list */}
      {isExpanded && (
        <div className="p-3 max-h-64 overflow-y-auto space-y-3">
          {events.map((event, index) => (
            <AgentEventItem key={`${event.type}-${index}`} event={event} />
          ))}
          
          {/* Show status indicator at bottom */}
          {status === 'exploring' && (
            <div className="text-sm text-gray-500 mt-2 flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
              <span>Agent is thinking...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface AgentEventItemProps {
  event: AgentEvent;
}

/**
 * Renders a single agent event
 */
const AgentEventItem: React.FC<AgentEventItemProps> = ({ event }) => {
  // Determine the icon and style based on event type
  const getEventTypeInfo = () => {
    switch (event.type) {
      case 'agent_started':
        return { icon: '🚀', label: 'Started', bgColor: 'bg-blue-50' };
      case 'agent_action':
        return { icon: '🔍', label: 'Action', bgColor: 'bg-purple-50' };
      case 'agent_answer':
        return { icon: '💡', label: 'Answer', bgColor: 'bg-green-50' };
      case 'step.started':
        return { icon: '🔄', label: 'Step Started', bgColor: 'bg-gray-50' };
      case 'step.completed':
        return { icon: '✅', label: 'Step Completed', bgColor: 'bg-gray-50' };
      case 'agent_completed':
        return { icon: '🏁', label: 'Completed', bgColor: 'bg-green-50' };
      case 'agent_error':
        return { icon: '❌', label: 'Error', bgColor: 'bg-red-50' };
      default:
        return { icon: '📋', label: event.type, bgColor: 'bg-gray-50' };
    }
  };
  
  const { icon, label, bgColor } = getEventTypeInfo();
  
  return (
    <div className={`text-sm rounded p-2 ${bgColor}`}>
      <div className="flex items-center mb-1">
        <span className="mr-1">{icon}</span>
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-xs text-gray-500">
          {new Date(event.timestamp).toLocaleTimeString()}
        </span>
      </div>
      
      {event.content && (
        <div className="text-gray-700 pl-5 whitespace-pre-wrap text-xs">
          {event.content}
        </div>
      )}
    </div>
  );
};

export default AgentEventViewer; 