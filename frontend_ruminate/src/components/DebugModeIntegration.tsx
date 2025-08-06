// frontend_ruminate/src/components/DebugModeIntegration.tsx
// Example integration showing how to add debug mode to your existing conversation component

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bug } from 'lucide-react';
import { usePromptApproval } from '@/hooks/usePromptApproval';
import { PromptApprovalModal } from './PromptApprovalModal';

interface DebugModeIntegrationProps {
  // Your existing conversation props
  conversationId: string;
  onSendMessage: (content: string, headers?: HeadersInit) => Promise<void>;
  sseEventSource?: EventSource;
  apiToken: string;
}

export const DebugModeIntegration: React.FC<DebugModeIntegrationProps> = ({
  conversationId,
  onSendMessage,
  sseEventSource,
  apiToken
}) => {
  const {
    pendingApprovalId,
    isDebugMode,
    toggleDebugMode,
    clearPendingApproval,
    addDebugHeaders,
    handleSSEMessage
  } = usePromptApproval();

  // Listen to SSE events
  React.useEffect(() => {
    if (!sseEventSource) return;

    sseEventSource.addEventListener('message', handleSSEMessage);
    
    return () => {
      sseEventSource.removeEventListener('message', handleSSEMessage);
    };
  }, [sseEventSource, handleSSEMessage]);

  // Wrap the original send message function to add debug headers
  const handleSendMessage = async (content: string) => {
    const headers = addDebugHeaders();
    await onSendMessage(content, headers);
  };

  return (
    <>
      {/* Debug Mode Toggle Button */}
      <div className="flex items-center gap-2 p-2 border-b">
        <Button
          variant={isDebugMode ? "default" : "outline"}
          size="sm"
          onClick={toggleDebugMode}
          className="gap-2"
        >
          <Bug className="h-4 w-4" />
          Debug Mode
        </Button>
        {isDebugMode && (
          <Badge variant="secondary">
            Prompt approval enabled
          </Badge>
        )}
      </div>

      {/* Prompt Approval Modal */}
      <PromptApprovalModal
        approvalId={pendingApprovalId}
        onClose={clearPendingApproval}
        apiToken={apiToken}
      />

      {/* Your existing conversation UI goes here */}
      {/* Just make sure to use handleSendMessage instead of onSendMessage */}
    </>
  );
};

// Example usage in your existing conversation component:
/*
const ConversationView = () => {
  const [messages, setMessages] = useState([]);
  const eventSource = useRef<EventSource>();
  
  // Your existing send message logic
  const sendMessage = async (content: string, headers?: HeadersInit) => {
    const response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers // This will include X-Debug-Mode when debug is enabled
      },
      body: JSON.stringify({ content })
    });
    // ... rest of your logic
  };

  return (
    <DebugModeIntegration
      conversationId={conversationId}
      onSendMessage={sendMessage}
      sseEventSource={eventSource.current}
      apiToken={userToken}
    >
      {/* Your existing UI }
    </DebugModeIntegration>
  );
};
*/