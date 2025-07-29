import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  id: string;
  question: string;
  type: string;
  order: number;
}

interface QuestionChipsProps {
  questions: Question[];
  onQuestionClick: (questionId: string, questionText: string) => void;
  isLoading?: boolean;
}

export const QuestionChips: React.FC<QuestionChipsProps> = ({
  questions,
  onQuestionClick,
  isLoading = false
}) => {
  if (questions.length === 0 || isLoading) {
    return null;
  }

  return (
    <div className="w-full px-4 py-2">
      <div className="flex flex-wrap gap-2">
        <AnimatePresence>
          {questions.map((question, index) => (
            <motion.button
              key={question.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ 
                delay: index * 0.05,
                duration: 0.3,
                ease: "easeOut"
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onQuestionClick(question.id, question.question)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 
                         border border-gray-200 dark:border-gray-700 
                         rounded-full shadow-sm hover:shadow-md 
                         transition-all duration-200
                         text-gray-700 dark:text-gray-300
                         hover:bg-gray-50 dark:hover:bg-gray-750
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {question.question}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Click a question to send it
      </div>
    </div>
  );
};