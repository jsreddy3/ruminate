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
    <div className="border rounded-md border-indigo-100 overflow-hidden">
      <div className="bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-800">
        Exploration Steps ({events.length})
      </div>
      
      <div className="divide-y divide-indigo-100">
        {events.map((event, index) => (
          <ExplorationStep key={index} event={event} />
        ))}
      </div>
    </div>
  );
}