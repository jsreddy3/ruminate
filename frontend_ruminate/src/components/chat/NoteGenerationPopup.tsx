import React, { useState, useEffect } from 'react';
import BaseModal from '../common/BaseModal';

interface NoteGenerationPopupProps {
  isVisible: boolean;
  totalMessages: number;
  onClose: () => void;
  onGenerate: (messageCount: number, topic: string) => void;
}

const NoteGenerationPopup: React.FC<NoteGenerationPopupProps> = ({
  isVisible,
  totalMessages,
  onClose,
  onGenerate
}) => {
  const [messageCount, setMessageCount] = useState(Math.min(10, totalMessages));
  const [topic, setTopic] = useState('');

  // Reset state when popup opens
  useEffect(() => {
    if (isVisible) {
      setMessageCount(Math.min(10, totalMessages));
      setTopic('');
    }
  }, [isVisible, totalMessages]);

  const handleGenerate = () => {
    onGenerate(messageCount, topic.trim());
  };

  return (
    <BaseModal
      isVisible={isVisible}
      onClose={onClose}
      title="Generate Note"
      maxWidth="max-w-sm"
    >
      <div className="space-y-3">
        {/* Message Count */}
        {totalMessages > 10 && (
          <div className="space-y-1">
            <label className="block text-sm text-gray-700">Messages to include</label>
            <input
              type="range"
              min="1"
              max={totalMessages}
              value={messageCount}
              onChange={(e) => setMessageCount(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-500 text-center">
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Topic */}
        <div className="space-y-1">
          <label className="block text-sm text-gray-700">Topic (optional)</label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g., key insights"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-transparent"
          />
        </div>
        
        {/* Footer */}
        <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-700 transition-colors"
          >
            Cancel
          </button>
          
          <button
            onClick={handleGenerate}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors"
          >
            Generate
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default NoteGenerationPopup;