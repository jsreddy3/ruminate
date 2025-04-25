import React from 'react';
import { AgentEvent } from '../../../hooks/useAgentEventStream';

interface LiveAgentStepsPaneProps {
  events: AgentEvent[];
}

/**
 * Displays live agent steps in a floating pane above the assistant message
 */
const LiveAgentStepsPane: React.FC<LiveAgentStepsPaneProps> = ({ events }) => {
  if (events.length === 0) return null;
  
  console.log("Rendering LiveAgentStepsPane with", events.length, "events");
  
  return (
    <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs max-w-[85%] mx-auto">
      <div className="font-medium mb-2 text-blue-700">Live Agent Steps</div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {events.map((event, idx) => (
          <div key={idx} className="p-1.5 flex items-start border-t border-blue-100 first:border-t-0">
            <span className="mr-1.5 flex-shrink-0">•</span>
            <div className="flex-grow">
              <div className="flex justify-between items-start">
                <span className="font-medium">{event.type}</span>
                <span className="text-gray-500 ml-2 flex-shrink-0 text-[10px]">
                  {new Date(event.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                  })}
                </span>
              </div>
              {event.content && <div className="mt-0.5 text-gray-700 whitespace-pre-wrap break-words">{event.content}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveAgentStepsPane; 