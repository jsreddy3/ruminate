import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Globe, CheckCircle } from 'lucide-react';

interface WebSearchEvent {
  type: 'tool_use';
  tool: 'web_search';
  status: 'starting' | 'searching' | 'completed';
  query?: string;
}

interface WebSearchIndicatorProps {
  event: WebSearchEvent | null;
}

export const WebSearchIndicator: React.FC<WebSearchIndicatorProps> = ({ event }) => {
  if (!event) return null;

  const getIcon = () => {
    switch (event.status) {
      case 'starting':
        return <Globe className="w-4 h-4 animate-pulse" />;
      case 'searching':
        return <Search className="w-4 h-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getMessage = () => {
    switch (event.status) {
      case 'starting':
        return 'Researching online...';
      case 'searching':
        return event.query ? `Searching: "${event.query}"` : 'Researching online...';
      case 'completed':
        return 'Finished external research!';
    }
  };

  const getBgColor = () => {
    switch (event.status) {
      case 'starting':
      case 'searching':
        return 'bg-blue-50 border-blue-200';
      case 'completed':
        return 'bg-green-50 border-green-200';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-2 px-3 py-2 mb-2 rounded-lg border ${getBgColor()}`}
      >
        {getIcon()}
        <span className="text-sm text-gray-700">{getMessage()}</span>
      </motion.div>
    </AnimatePresence>
  );
};