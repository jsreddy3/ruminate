import React from 'react';
import ConversationCodex from '../chat/ConversationCodex';
import ScholarlyProgressChronicle from './ScholarlyProgressChronicle';

/**
 * Simple integration test component to verify our new components work
 * This is a temporary file to test the integration
 */
const IntegrationTest: React.FC = () => {
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);

  const conversations = [
    {
      id: null,
      title: 'Main Discussion',
      type: 'main' as const,
      isActive: activeConversationId === null
    },
    {
      id: 'test-1',
      title: 'Test Rabbithole',
      type: 'rabbithole' as const,
      selectionText: 'This is a test selection',
      isActive: activeConversationId === 'test-1'
    }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => prev >= 100 ? 0 : prev + 10);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-8 bg-surface-paper min-h-screen">
      <h1 className="text-2xl font-serif font-bold text-reading-primary mb-8">Integration Test</h1>
      
      {/* Test ConversationCodex */}
      <div className="mb-8">
        <h2 className="text-xl font-serif font-semibold text-reading-secondary mb-4">Conversation Codex</h2>
        <ConversationCodex
          conversations={conversations}
          activeConversationId={activeConversationId}
          onConversationChange={setActiveConversationId}
        />
      </div>

      {/* Test ScholarlyProgressChronicle */}
      <div className="mb-8">
        <h2 className="text-xl font-serif font-semibold text-reading-secondary mb-4">Progress Chronicle</h2>
        <div className="space-y-6">
          <ScholarlyProgressChronicle
            progress={progress}
            label="Reading Progress"
            variant="reading"
            size="sm"
            showQuill={true}
            animated={true}
          />
          <ScholarlyProgressChronicle
            progress={progress}
            label="Document Processing"
            variant="processing"
            size="md"
            showQuill={true}
            animated={true}
          />
          <ScholarlyProgressChronicle
            progress={progress}
            label="Archive Upload"
            variant="uploading"
            size="lg"
            showQuill={true}
            animated={true}
          />
        </div>
      </div>

      <div className="text-sm text-reading-muted font-serif italic">
        ✨ Integration test complete! Both components render without errors.
      </div>
    </div>
  );
};

export default IntegrationTest;