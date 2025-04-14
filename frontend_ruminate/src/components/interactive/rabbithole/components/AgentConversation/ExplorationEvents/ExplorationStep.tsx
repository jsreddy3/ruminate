// src/components/interactive/rabbithole/components/AgentConversation/ExplorationEvents/ExplorationStep.tsx
import { AgentEvent } from "../../../../../../services/rabbithole";
import EventTypeIcon from "./EventTypeIcon";

interface ExplorationStepProps {
  event: AgentEvent;
}

export default function ExplorationStep({ event }: ExplorationStepProps) {
  // Define colors based on event type
  const getColorClass = () => {
    switch (event.type) {
      case 'agent_action':
        return 'bg-blue-50 border-blue-100';
      case 'agent_answer':
        return 'bg-green-50 border-green-100';
      case 'agent_error':
      case 'agent_timeout':
        return 'bg-red-50 border-red-100';
      default:
        return 'bg-gray-50 border-gray-100';
    }
  };
  
  return (
    <div className={`p-3 ${getColorClass()} text-sm`}>
      <div className="flex items-start">
        <div className="mr-3 mt-0.5">
          <EventTypeIcon type={event.type} />
        </div>
        
        <div className="flex-1 overflow-hidden">
          <div className="font-medium mb-1">
            {event.action || event.type.replace('agent_', '')}
          </div>
          
          {event.input && (
            <div className="text-xs text-gray-700 mb-1">
              <span className="font-medium">Input:</span> {event.input}
            </div>
          )}
          
          {event.result_preview && (
            <div className="text-xs text-gray-700 bg-white p-2 rounded border border-gray-200 overflow-x-auto">
              <span className="font-medium">Result:</span> {event.result_preview}
            </div>
          )}
          
          {event.message && (
            <div className="text-xs text-gray-700">
              {event.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}