// src/components/interactive/rabbithole/components/AgentConversation/ExplorationEvents/ExplorationStep.tsx
import { AgentEvent } from "../../../../../../services/rabbithole";
import EventTypeIcon from "./EventTypeIcon";

interface ExplorationStepProps {
  event: AgentEvent;
}

export default function ExplorationStep({ event }: ExplorationStepProps) {
  // Define colors based on event type
  const getColorConfig = () => {
    switch (event.type) {
      case 'agent_action':
        return {
          iconColor: 'text-indigo-600',
          borderColor: 'border-indigo-200',
          bgColor: 'bg-indigo-50',
          headingColor: 'text-indigo-700'
        };
      case 'agent_answer':
        return {
          iconColor: 'text-emerald-600',
          borderColor: 'border-emerald-200',
          bgColor: 'bg-emerald-50',
          headingColor: 'text-emerald-700'
        };
      case 'agent_error':
      case 'agent_timeout':
        return {
          iconColor: 'text-rose-600',
          borderColor: 'border-rose-200',
          bgColor: 'bg-rose-50',
          headingColor: 'text-rose-700'
        };
      default:
        return {
          iconColor: 'text-slate-600',
          borderColor: 'border-slate-200',
          bgColor: 'bg-slate-50',
          headingColor: 'text-slate-700'
        };
    }
  };
  
  const colors = getColorConfig();
  
  return (
    <div className={`mb-2 rounded-lg overflow-hidden border ${colors.borderColor} shadow-sm`}>
      {/* Header */}
      <div className={`flex items-center px-3 py-2 ${colors.bgColor}`}>
        <div className={`mr-2 ${colors.iconColor}`}>
          <EventTypeIcon type={event.type} />
        </div>
        <div className={`text-sm font-medium ${colors.headingColor}`}>
          {event.action || event.type.replace('agent_', '')}
        </div>
      </div>
      
      {/* Content */}
      <div className="px-3 py-2 bg-white">
        {event.input && (
          <div className="mb-2">
            <div className="text-xs font-medium text-slate-500 mb-1">Input</div>
            <div className="text-sm text-slate-700 font-mono bg-slate-50 p-1.5 rounded">
              {event.input}
            </div>
          </div>
        )}
        
        {event.result_preview && (
          <div className="mb-2">
            <div className="text-xs font-medium text-slate-500 mb-1">Result</div>
            <div className="text-sm text-slate-700 font-mono bg-slate-50 p-1.5 rounded max-h-24 overflow-y-auto">
              {event.result_preview}
            </div>
          </div>
        )}
        
        {event.message && (
          <div className="text-sm text-slate-700">
            {event.message}
          </div>
        )}
      </div>
    </div>
  );
}