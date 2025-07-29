import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';

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
  const popupRef = useRef<HTMLDivElement>(null);
  const [messageCount, setMessageCount] = useState(Math.min(10, totalMessages));
  const [topic, setTopic] = useState('');

  // Reset state when popup opens
  useEffect(() => {
    if (isVisible) {
      setMessageCount(Math.min(10, totalMessages));
      setTopic('');
    }
  }, [isVisible, totalMessages]);

  // Close when clicking outside
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Close on Escape key
  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose]);

  if (!isVisible) {
    return null;
  }

  const handleGenerate = () => {
    onGenerate(messageCount, topic.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div
        ref={popupRef}
        className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-sm mx-4"
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
          <h3 className="font-medium text-gray-900">Generate Note</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-3">
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
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex justify-end gap-2">
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
    </div>
  );
};

export default NoteGenerationPopup;