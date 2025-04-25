import React, { useEffect, useRef } from 'react';
import { AgentEvent } from '../../../hooks/useAgentEventStream';

interface LiveAgentStepsPaneProps {
  events: AgentEvent[];
}

// Helper to get icon and color based on event type
const getEventStyleInfo = (type: string): { icon: string; bgColor: string; textColor: string } => {
  if (type.startsWith('agent_action')) {
    return { icon: '🔍', bgColor: 'bg-blue-50', textColor: 'text-blue-700' };
  } else if (type.startsWith('agent_answer')) {
    return { icon: '💡', bgColor: 'bg-green-50', textColor: 'text-green-700' };
  } else if (type.startsWith('agent_error')) {
    return { icon: '⚠️', bgColor: 'bg-red-50', textColor: 'text-red-700' };
  } else if (type.startsWith('step.completed')) {
    return { icon: '✓', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700' };
  } else if (type.startsWith('step.started')) {
    return { icon: '→', bgColor: 'bg-purple-50', textColor: 'text-purple-700' };
  } else if (type.startsWith('tool:')) {
    return { icon: '🔧', bgColor: 'bg-amber-50', textColor: 'text-amber-700' };
  } else if (type === 'thinking') {
    return { icon: '💭', bgColor: 'bg-gray-50', textColor: 'text-gray-700' };
  } else {
    return { icon: '•', bgColor: 'bg-gray-50', textColor: 'text-gray-700' };
  }
};

/**
 * Displays live agent steps in a floating pane above the assistant message
 */
const LiveAgentStepsPane: React.FC<LiveAgentStepsPaneProps> = ({ events }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when new events come in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length]);
  
  if (events.length === 0) return null;
  
  console.log("Rendering LiveAgentStepsPane with", events.length, "events");
  
  // Get just the useful event types - filter out noise
  const filteredEvents = events.filter(event => 
    !event.type.startsWith('ping') && 
    !event.type.startsWith('connected')
  );
  
  return (
    <div className="mb-3 overflow-hidden rounded-lg border border-blue-200 shadow-sm animate-fadeIn">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-white mr-2">⚡</span>
          <h3 className="text-white text-sm font-medium">Agent Exploring</h3>
        </div>
        <div className="flex items-center space-x-1">
          <div className="h-1.5 w-1.5 bg-blue-300 rounded-full animate-pulse"></div>
          <div className="h-1.5 w-1.5 bg-blue-300 rounded-full animate-pulse delay-150"></div>
          <div className="h-1.5 w-1.5 bg-blue-300 rounded-full animate-pulse delay-300"></div>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="max-h-48 overflow-y-auto p-2 bg-gradient-to-b from-blue-50 to-white"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="space-y-1.5">
          {filteredEvents.map((event, idx) => {
            const { icon, bgColor, textColor } = getEventStyleInfo(event.type);
            
            // Parse tool name if present
            const toolMatch = event.type.match(/tool:(.+)/);
            const displayTitle = toolMatch ? `Tool: ${toolMatch[1].trim()}` : event.type;
            
            return (
              <div 
                key={idx} 
                className={`${bgColor} rounded-md p-2 text-xs border border-opacity-10 animate-fadeIn shadow-sm transition-all duration-200`}
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start">
                  <span className="mr-2 flex-shrink-0 text-base">{icon}</span>
                  <div className="flex-grow min-w-0">
                    <div className="flex justify-between items-start">
                      <span className={`font-medium ${textColor} truncate`}>
                        {displayTitle}
                      </span>
                      <span className="text-[10px] text-gray-500 ml-2 flex-shrink-0 tabular-nums">
                        {new Date(event.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          second: '2-digit' 
                        })}
                      </span>
                    </div>
                    {event.content && (
                      <div className="mt-1 text-gray-700 whitespace-pre-wrap break-words rounded bg-white bg-opacity-60 p-1.5 overflow-hidden">
                        {event.content.length > 300 
                          ? `${event.content.substring(0, 300)}...` 
                          : event.content}
                      </div>
                    )}
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">Details</summary>
                        <div className="mt-1 text-[10px] bg-white bg-opacity-60 p-1.5 rounded overflow-x-auto">
                          <pre className="whitespace-pre-wrap break-words">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="bg-gray-50 px-3 py-1.5 border-t border-blue-100 text-[10px] text-gray-500 flex justify-between items-center">
        <span>
          {filteredEvents.length} agent operations
        </span>
        <span className="inline-flex items-center">
          <span className="h-1.5 w-1.5 bg-green-500 rounded-full mr-1"></span>
          Connected to agent
        </span>
      </div>
    </div>
  );
};

export default LiveAgentStepsPane; 