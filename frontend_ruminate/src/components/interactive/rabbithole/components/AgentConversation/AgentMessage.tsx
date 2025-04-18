// src/components/interactive/rabbithole/components/AgentConversation/AgentMessage.tsx
import { useState, useEffect, useMemo } from "react";
import { Message } from "../../../../../types/chat";
import { AgentEvent, AgentStep } from "../../../../../services/rabbithole";
import { useAgentSteps } from "../../../../../hooks/useAgentSteps";
import ExplorationPanel from "./ExplorationEvents/ExplorationPanel";
import MessageActions from "../../../../common/MessageActions";

interface AgentMessageProps {
  message: Message;
  conversationId: string;
  events: AgentEvent[];
  isLoading: boolean;
  documentId: string;
  blockId: string; // Required parameter
  blockSequenceNo?: number;
  onSwitchToNotesTab?: () => void;
}

export default function AgentMessage({ message, conversationId, events, isLoading, documentId, blockId, blockSequenceNo, onSwitchToNotesTab }: AgentMessageProps) {
  const [showExploration, setShowExploration] = useState(false);
  
  // Get stored process steps for this message
  const { steps: storedSteps, loading: stepsLoading } = useAgentSteps(conversationId, message.id);
  
  // Use either real-time events (if loading) or stored steps (if complete)
  const explorationData = useMemo(() => {
    // If we're still loading or if stored steps aren't ready yet but we have events, use real-time events
    if (isLoading || (storedSteps.length === 0 && events.length > 0)) {
      // Filter out any result-related events - they're too cluttered for users
      // Since 'result' isn't in AgentEventType, we need a different approach
      return events.filter(event => !(event.type === 'agent_action' && event.result_preview));
    }
    
    // Otherwise, use stored steps from the database
    return storedSteps
      // Filter out result type steps - they're too cluttered for users
      .filter(step => step.step_type !== 'result')
      .map(step => ({
        type: step.step_type as any, // Convert to AgentEventType
        action: step.metadata?.action,
        input: step.metadata?.input,
        result_preview: step.metadata?.result,
        message: step.content,
        timestamp: new Date(step.created_at).getTime()
      }));
  }, [events, storedSteps, isLoading]);
  
  // Log for debugging
  // console.log(`AgentMessage ${message.id}: ${events.length} real-time events, ${storedSteps.length} stored steps, isLoading=${isLoading}`);
  
  // Don't auto-show exploration steps anymore - keep collapsed by default
  // The previous code automatically expanded steps, but we now want them collapsed
  
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        {/* Exploration steps now BEFORE the message */}
        {explorationData.length > 0 && (
          <div className="mb-2">
            <button
              onClick={() => setShowExploration(!showExploration)}
              className="text-xs text-indigo-600 mb-1 flex items-center"
            >
              <span className="mr-1">{showExploration ? '▼' : '►'}</span>
              {showExploration ? 'Hide exploration' : 'Show exploration'} ({explorationData.length} steps)
            </button>
            
            {showExploration && (
              <div className="mb-3">
                <ExplorationPanel events={explorationData} isExpanded={true} />
              </div>
            )}
          </div>
        )}
        
        {/* AI message after exploration steps */}
        <div className="bg-indigo-50 text-neutral-800 p-3 rounded-lg shadow-sm border border-indigo-100 relative group">
          {isLoading ? (
            <div className="flex items-center">
              <div className="thinking-animation mr-2">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <em>AI is exploring...</em>
            </div>
          ) : (
            <>
              <div className="prose prose-sm max-w-none">
                {message.content}
              </div>
              
              {/* Note generation button - only visible on hover */}
              <div className="absolute top-1 right-1">
                <MessageActions
                  message={message}
                  documentId={documentId}
                  blockId={blockId}
                  conversationId={conversationId}
                  blockSequenceNo={blockSequenceNo}
                  onSwitchToNotesTab={onSwitchToNotesTab}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </div>
            </>
          )}
        </div>
        
        {/* Add CSS for thinking animation dots */}
        <style jsx>{`
          .thinking-animation {
            display: inline-flex;
            align-items: center;
          }
          .thinking-animation span {
            background-color: #6366f1;
            border-radius: 50%;
            display: inline-block;
            width: 4px;
            height: 4px;
            margin: 0 1px;
            opacity: 0.6;
            animation: thinking 1.4s infinite ease-in-out both;
          }
          .thinking-animation span:nth-child(1) {
            animation-delay: 0s;
          }
          .thinking-animation span:nth-child(2) {
            animation-delay: 0.2s;
          }
          .thinking-animation span:nth-child(3) {
            animation-delay: 0.4s;
          }
          @keyframes thinking {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}