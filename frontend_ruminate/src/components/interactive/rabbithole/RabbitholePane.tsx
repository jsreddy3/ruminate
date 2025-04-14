// src/components/interactive/rabbithole/RabbitholePane.tsx
import { useState, useEffect, useRef } from "react";
import { useConversation } from "../../../hooks/useConversation";
import { createAgentRabbithole } from "../../../services/rabbithole";
import RabbitholeHeader from "./components/RabbitholeHeader";
import SelectedTextDisplay from "./components/SelectedTextDisplay";
import AgentConversation from "./components/AgentConversation";

interface RabbitholePaneProps {
  selectedText: string;
  documentId: string;
  conversationId?: string;
  documentConversationId?: string;
  blockId?: string;
  textStartOffset?: number;
  textEndOffset?: number;
  onClose: () => void;
}

export default function RabbitholePane({
  selectedText,
  documentId,
  conversationId,
  documentConversationId,
  blockId,
  textStartOffset,
  textEndOffset,
  onClose
}: RabbitholePaneProps) {
  const [isCreatingRabbithole, setIsCreatingRabbithole] = useState<boolean>(false);
  const [rabbitholeConversationId, setRabbitholeConversationId] = useState<string | null>(conversationId || null);
  
  // Initialize the rabbithole conversation
  useEffect(() => {
    if (conversationId) {
      setRabbitholeConversationId(conversationId);
      return;
    }
    
    if (isCreatingRabbithole || rabbitholeConversationId) return;
    
    async function createNewAgentRabbithole() {
      if (!blockId || textStartOffset === undefined || textEndOffset === undefined) {
        console.error("Missing data required to create rabbithole");
        return;
      }
      
      setIsCreatingRabbithole(true);
      
      try {
        const newRabbitholeId = await createAgentRabbithole({
          document_id: documentId,
          block_id: blockId,
          selected_text: selectedText,
          start_offset: textStartOffset,
          end_offset: textEndOffset,
          type: 'rabbithole',
          document_conversation_id: documentConversationId
        });
        
        setRabbitholeConversationId(newRabbitholeId);
      } catch (error) {
        console.error('Failed to create agent rabbithole:', error);
      } finally {
        setIsCreatingRabbithole(false);
      }
    }
    
    createNewAgentRabbithole();
  }, [blockId, documentId, conversationId, documentConversationId, isCreatingRabbithole, rabbitholeConversationId, selectedText, textEndOffset, textStartOffset]);

  return (
    <div className="h-full flex flex-col bg-white text-neutral-800 border-l border-neutral-200 shadow-lg">
      <RabbitholeHeader onClose={onClose} />
      <SelectedTextDisplay text={selectedText} />
      
      {isCreatingRabbithole ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-indigo-600 flex flex-col items-center">
            <div className="loader w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <p>Creating rabbithole...</p>
          </div>
        </div>
      ) : (
        <AgentConversation
          conversationId={rabbitholeConversationId}
          documentId={documentId}
          initialMessageDraft={`Explain this: "${selectedText}"`}
        />
      )}
    </div>
  );
}