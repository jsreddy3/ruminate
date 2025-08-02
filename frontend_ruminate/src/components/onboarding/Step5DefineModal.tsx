import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ArrowDown } from 'lucide-react';

interface Step5DefineModalProps {
  isVisible: boolean;
  onComplete: () => void;
}

export const Step5DefineModal: React.FC<Step5DefineModalProps> = ({
  isVisible,
  onComplete
}) => {
  if (!isVisible) return null;

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black/20"
        style={{ backdropFilter: 'blur(2px)' }}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[201]"
      >
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 border border-library-sage-200">
          <div className="text-center">
            <div className="mb-6">
              <div className="w-16 h-16 mx-auto bg-library-gold-100 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="w-8 h-8 text-library-mahogany-600" />
              </div>
              <h3 className="text-xl font-serif font-semibold text-reading-primary mb-3">
                Great! Now try the "Key Term" button
              </h3>
              <p className="text-reading-secondary text-sm leading-relaxed">
                Click the highlighted "Key Term" button in your text selection tooltip to define the selected text.
              </p>
            </div>
            
            <div className="flex items-center justify-center mb-6">
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="flex flex-col items-center gap-2"
              >
                <ArrowDown className="w-5 h-5 text-library-gold-600" />
                <div className="px-3 py-1.5 bg-library-gold-100 border border-library-gold-400 rounded flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-library-mahogany-600" />
                  <span className="text-sm font-serif text-reading-primary">Key Term</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};