import React, { useEffect, useRef } from 'react';
import { MessageSquarePlus, BookOpen, Search, FileText } from 'lucide-react';

interface TextSelectionTooltipProps {
  documentId: string;
  blockId: string;
  isVisible: boolean;
  position: { x: number; y: number };
  selectedText: string;
  onAddToChat?: (text: string) => void;
  onDefine?: (text: string) => void;
  onCreateRabbithole?: (text: string, startOffset: number, endOffset: number) => void;
  onAnnotate?: (text: string) => void;
  onClose: () => void;
  isDefining?: boolean;
}

const TextSelectionTooltip: React.FC<TextSelectionTooltipProps> = ({
  documentId,
  blockId,
  isVisible,
  position,
  selectedText,
  onAddToChat,
  onDefine,
  onCreateRabbithole,
  onAnnotate,
  onClose,
  isDefining = false,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Simple approach for managing tooltip visibility
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if clicked inside tooltip
      if (tooltipRef.current && tooltipRef.current.contains(event.target as Node)) {
        return;
      }
      
      // Otherwise close the tooltip
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  // Close tooltip when pressing Escape
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

  if (!isVisible) return null;
  
  // Create a safe wrapper for action click handlers
  const safeExecute = (callback?: (text: string) => void) => {
    return () => {
      if (callback) {
        callback(selectedText);
      }
    };
  };

  // Default actions if none provided
  const defaultActions = [
    {
      label: 'Add to chat',
      icon: <MessageSquarePlus size={16} />,
      onClick: safeExecute(onAddToChat),
    },
    ...( onCreateRabbithole ? [{
      label: 'Create chat',
      icon: <Search size={16} />,
      onClick: () => {
        if (onCreateRabbithole) {
          // For now, use dummy offsets - we'll need to get real ones from the selection
          onCreateRabbithole(selectedText, 0, selectedText.length);
        }
      },
    }] : []),
    ...( onDefine ? [{
      label: isDefining ? 'Defining...' : 'Define',
      icon: isDefining ? (
        <div className="animate-spin w-4 h-4 border-2 border-library-gold-600 border-t-transparent rounded-full" />
      ) : (
        <BookOpen size={16} />
      ),
      onClick: isDefining ? undefined : safeExecute(onDefine),
      disabled: isDefining,
    }] : []),
    ...( onAnnotate ? [{
      label: 'Annotate',
      icon: <FileText size={16} />,
      onClick: safeExecute(onAnnotate),
    }] : [])
  ];

  // Adjust position to ensure tooltip is visible
  const adjustedPosition = { ...position };
  
  // Ensure tooltip appears above the selection
  adjustedPosition.y = Math.max(40, position.y); // At least 40px from top of viewport
  
  // Constrain x position to not exceed viewport
  const tooltipWidth = 160; // Increased width for longer button text
  adjustedPosition.x = Math.min(
    Math.max(tooltipWidth / 2, position.x), 
    window.innerWidth - tooltipWidth / 2
  );

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed', // Use fixed to position relative to viewport
    left: `${adjustedPosition.x}px`,
    top: `${adjustedPosition.y}px`,
    zIndex: 1000,
    transform: 'translate(-50%, -100%)', // Center horizontally, position ABOVE selection
    pointerEvents: 'all', // Ensure tooltip intercepts all pointer events
    marginBottom: '5px', // Small gap between tooltip and selection
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))', // Add shadow for better visibility
  };

  return (
    <div 
      ref={tooltipRef}
      className="selection-tooltip bg-gradient-to-br from-surface-paper to-library-cream-50 rounded-lg shadow-shelf border border-library-sage-300 text-sm py-1 px-1 transition-transform duration-200 ease-out hover:scale-105 group"
      style={tooltipStyle}
    >
      <div className="animate-fadeIn">
        <div className="flex">
          {defaultActions.map((action, index) => (
            <button
              key={index}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 whitespace-nowrap transition-colors duration-150 font-serif ${
                action.disabled 
                  ? 'text-library-sage-400 cursor-not-allowed bg-library-sage-50' 
                  : 'hover:bg-library-gold-50 text-reading-secondary hover:text-reading-primary'
              }`}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.disabled ? 'Generating definition...' : `${action.label}: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`}
            >
              {action.icon && <span className={action.disabled ? "text-library-sage-300" : "text-library-mahogany-500"}>{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
        {/* Triangle pointer */}
        <div 
          className="absolute w-3 h-3 bg-gradient-to-br from-surface-paper to-library-cream-100 border-b border-r border-library-sage-300 transform rotate-45"
          style={{ 
            left: '50%', 
            bottom: '-6px', 
            marginLeft: '-6px'
          }}
        ></div>
      </div>
    </div>
  );
};

export default TextSelectionTooltip;
