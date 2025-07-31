import React from 'react';
import { motion } from 'framer-motion';

interface MainConversationButtonProps {
  isActive: boolean;
  onConversationChange: (id: string | null) => void;
}

const MainConversationButton: React.FC<MainConversationButtonProps> = ({
  isActive,
  onConversationChange
}) => {
  return (
    <motion.button
      className={`
        relative w-12 h-12 rounded-book cursor-pointer transition-all duration-300 ease-out
        ${isActive 
          ? 'bg-library-mahogany-500 shadow-book ring-2 ring-library-gold-400' 
          : 'bg-library-mahogany-400 hover:bg-library-mahogany-500 hover:shadow-book'
        }
        ${isActive ? '' : 'hover:scale-105'}
      `}
      onClick={() => onConversationChange(null)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.9 }}
      title="Main Discussion"
    >
      <div className="w-full h-full flex items-center justify-center text-library-cream-50 text-sm font-bold font-serif">
        Main
      </div>

      {/* Active indicator dot */}
      {isActive && (
        <motion.div
          className="absolute -top-1 -right-1 w-3 h-3 bg-library-gold-400 rounded-full border-2 border-library-cream-50 shadow-lg"
          layoutId="mainActiveIndicator"
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>
  );
};

export default MainConversationButton;