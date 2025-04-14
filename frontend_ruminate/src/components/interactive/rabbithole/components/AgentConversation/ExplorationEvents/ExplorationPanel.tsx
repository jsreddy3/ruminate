// src/components/interactive/rabbithole/components/AgentConversation/ExplorationEvents/ExplorationPanel.tsx
import { AgentEvent } from "../../../../../../services/rabbithole";
import ExplorationStep from "./ExplorationStep";

interface ExplorationPanelProps {
  events: AgentEvent[];
  isExpanded: boolean;
}

export default function ExplorationPanel({ events, isExpanded }: ExplorationPanelProps) {
  if (events.length === 0) return null;
  
  return (
    <div className="p-2 bg-slate-50 rounded-lg">
      <div className="flex items-center mb-2">
        <div className="bg-indigo-100 rounded-full p-1 mr-2">
          <svg className="w-3 h-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="text-xs font-medium text-slate-600">
          Exploration Path ({events.length} steps)
        </div>
      </div>
      
      <div className="space-y-0">
        {events.map((event, index) => (
          <ExplorationStep key={index} event={event} />
        ))}
      </div>
    </div>
  );
}