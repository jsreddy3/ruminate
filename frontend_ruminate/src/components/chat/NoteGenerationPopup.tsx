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
      maxWidth="max-w-md"
      className="animate-fade-in"
      backdropClassName="bg-library-forest-900 bg-opacity-20 backdrop-blur-paper"
    >
      <div className="space-y-5">
        
        {/* Elegant header with scholarly icon */}
        <div className="flex items-center gap-3 pb-4 border-b border-library-sage-200">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-library-gold-400 to-library-gold-600 flex items-center justify-center shadow-book">
            <svg className="w-4 h-4 text-library-cream-50" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
          <div>
            <h3 className="font-serif font-semibold text-lg text-reading-primary">Distill Note</h3>
            <p className="text-sm text-reading-muted font-sans">Create a summary from your conversation</p>
          </div>
        </div>

        {/* Message Count Selector */}
        {totalMessages > 10 && (
          <div className="space-y-3">
            <label className="block font-serif font-medium text-reading-secondary">
              Include {messageCount} of {totalMessages} messages
            </label>
            
            {/* Custom styled range input */}
            <div className="relative">
              <input
                type="range"
                min="1"
                max={totalMessages}
                value={messageCount}
                onChange={(e) => setMessageCount(parseInt(e.target.value))}
                className="w-full h-2 bg-gradient-to-r from-library-sage-200 to-library-sage-300 rounded-full appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #af5f37 0%, #af5f37 ${(messageCount / totalMessages) * 100}%, #dde1dd ${(messageCount / totalMessages) * 100}%, #dde1dd 100%)`
                }}
              />
              
              {/* Custom slider thumb styling */}
              <style jsx>{`
                .slider::-webkit-slider-thumb {
                  appearance: none;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #f9cf5f, #edbe51);
                  cursor: pointer;
                  box-shadow: 0 2px 6px rgba(175, 95, 55, 0.3);
                  border: 2px solid white;
                  transition: all 0.2s ease;
                }
                .slider::-webkit-slider-thumb:hover {
                  transform: scale(1.1);
                  box-shadow: 0 3px 8px rgba(175, 95, 55, 0.4);
                }
                .slider::-moz-range-thumb {
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, #f9cf5f, #edbe51);
                  cursor: pointer;
                  box-shadow: 0 2px 6px rgba(175, 95, 55, 0.3);
                  border: 2px solid white;
                }
              `}</style>
            </div>
          </div>
        )}

        {/* Topic Input */}
        <div className="space-y-2">
          <label className="block font-serif font-medium text-reading-secondary">
            Focus <span className="text-reading-muted font-sans text-sm">(optional)</span>
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="key insights, main themes..."
            className="w-full px-4 py-2.5 font-serif text-reading-primary bg-gradient-to-br from-surface-paper to-library-cream-50 border-2 border-library-sage-300 rounded-journal focus:outline-none focus:border-library-mahogany-400 focus:shadow-definition transition-all duration-300 placeholder:text-reading-muted placeholder:italic"
            style={{
              background: `linear-gradient(135deg, #fefcf7 0%, #fcf0d2 100%)`
            }}
          />
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-reading-muted hover:text-reading-secondary transition-colors font-serif"
          >
            Cancel
          </button>
          
          <button
            onClick={handleGenerate}
            className="px-5 py-2 bg-gradient-to-r from-library-mahogany-500 to-library-mahogany-600 hover:from-library-mahogany-600 hover:to-library-mahogany-700 text-library-cream-50 rounded-journal transition-all duration-300 shadow-book hover:shadow-deep font-serif"
          >
            Distill
          </button>
        </div>
      </div>
    </BaseModal>
  );
};

export default NoteGenerationPopup;