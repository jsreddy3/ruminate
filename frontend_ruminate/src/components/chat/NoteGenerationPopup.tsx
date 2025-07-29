import React, { useState, useRef, useEffect } from 'react';
import { X, FileText, MessageSquare } from 'lucide-react';

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
  const [isGenerating, setIsGenerating] = useState(false);

  // Reset state when popup opens
  useEffect(() => {
    if (isVisible) {
      setMessageCount(Math.min(10, totalMessages));
      setTopic('');
      setIsGenerating(false);
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

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate(messageCount, topic.trim());
      // onGenerate will handle closing the popup after block selection
    } catch (error) {
      console.error('Failed to generate note:', error);
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={popupRef}
        className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-md mx-4 animate-fadeIn"
      >
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-gray-200 bg-blue-50 rounded-t-lg">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-blue-600" />
            <h3 className="font-semibold text-blue-900">Generate Note from Conversation</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-blue-500 hover:text-blue-700 transition-colors"
            disabled={isGenerating}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Message Count Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Messages to include
            </label>
            <div className="space-y-2">
              <input
                type="range"
                min="1"
                max={totalMessages}
                value={messageCount}
                onChange={(e) => setMessageCount(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1</span>
                <span className="font-medium text-blue-600">
                  {messageCount} message{messageCount !== 1 ? 's' : ''}
                </span>
                <span>{totalMessages}</span>
              </div>
            </div>
            {totalMessages <= 10 && (
              <p className="text-xs text-gray-500">
                Including all {totalMessages} messages in this conversation
              </p>
            )}
          </div>

          {/* Topic Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Topic focus (optional)
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 'key insights about neural networks'"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500">
              Leave empty for a general summary of the conversation
            </p>
          </div>

          {/* Next Steps Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
            <div className="flex items-start gap-2">
              <MessageSquare size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Next step:</p>
                <p>After clicking Generate, you'll be prompted to select which block in your PDF to attach the note to.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText size={16} />
            {isGenerating ? 'Preparing...' : 'Generate Note'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NoteGenerationPopup;