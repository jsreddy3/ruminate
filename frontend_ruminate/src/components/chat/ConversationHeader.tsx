import React from 'react';

interface ConversationHeaderProps {
  conversationType: 'main' | 'rabbithole';
  selectedText?: string;
}

const ConversationHeader: React.FC<ConversationHeaderProps> = ({
  conversationType,
  selectedText
}) => {
  const isMainConversation = conversationType === 'main';
  
  const displayText = selectedText && selectedText.length > 70 
    ? `${selectedText.substring(0, 70)}...` 
    : selectedText;

  return (
    <div className="flex items-center justify-center p-6 mb-4">
      <div className="w-[85%] max-w-none">
        {isMainConversation ? (
          <div className="bg-gradient-to-b from-surface-parchment/30 to-library-cream-50/30 border border-library-sage-200/40 rounded-2xl px-6 py-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-library-mahogany-50 rounded-full flex items-center justify-center mb-6 border border-library-mahogany-100">
              <svg className="w-6 h-6 text-library-mahogany-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            
            <h3 style={{ fontFamily: 'Iowan Old Style, serif', fontSize: '1.5rem' }} className="font-medium text-reading-primary mb-3">
              Main Conversation
            </h3>
            
            <p className="text-reading-secondary text-lg leading-relaxed">
              This conversation follows you through the document. Ask any question—your co-reader sees what you see.
            </p>
          </div>
        ) : (
          <div className="bg-gradient-to-b from-library-cream-50/40 to-library-gold-50/20 border border-library-gold-200/40 rounded-2xl px-6 py-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-library-gold-50 rounded-full flex items-center justify-center mb-6 border border-library-gold-100">
              <svg className="w-6 h-6 text-library-gold-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <h3 style={{ fontFamily: 'Iowan Old Style, serif', fontSize: '1.5rem' }} className="font-medium text-reading-primary mb-3">
              Focused Conversation
            </h3>
            
            {displayText && (
              <div className="mb-4 p-3 bg-surface-paper/60 border-l-2 border-library-gold-300 rounded text-left">
                <p style={{ fontFamily: 'Iowan Old Style, serif' }} className="text-reading-secondary text-lg italic">
                  "{displayText}"
                </p>
              </div>
            )}
            
            <p className="text-reading-secondary text-lg leading-relaxed">
              This conversation focuses on the selected text. Dive deep into this specific passage.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationHeader;