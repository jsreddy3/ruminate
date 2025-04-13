import React, { useEffect, useRef } from 'react';
import { MessageSquarePlus, BookOpen } from 'lucide-react';

interface TextSelectionTooltipProps {
  isVisible: boolean;
  position: { x: number, y: number };
  selectedText: string;
  onAddToChat: (text: string) => void;
  onDefine?: (text: string) => void;
  onRabbithole?: (text: string) => void;
  actions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: (text: string) => void;
  }>;
  onClose: () => void;
}

const TextSelectionTooltip: React.FC<TextSelectionTooltipProps> = ({
  isVisible,
  position,
  selectedText,
  onAddToChat,
  onDefine,
  onRabbithole,
  actions = [],
  onClose,
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

  // Default actions if none provided
  const defaultActions = actions.length > 0 ? actions : [
    {
      label: 'Add to chat',
      icon: <MessageSquarePlus size={16} />,
      onClick: onAddToChat,
    },
    ...( onDefine ? [{
      label: 'Define',
      icon: <BookOpen size={16} />,
      onClick: onDefine,
    }] : []),
    ...( onRabbithole ? [{
      label: 'Rabbithole',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18H6V12Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 12C10 12.5523 9.55228 13 9 13C8.44772 13 8 12.5523 8 12C8 11.4477 8.44772 11 9 11C9.55228 11 10 11.4477 10 12Z" fill="currentColor" />
      </svg>,
      onClick: onRabbithole,
    }] : [])
  ];

  // Adjust position to ensure tooltip is visible
  const adjustedPosition = { ...position };
  
  // Ensure tooltip appears above the selection
  adjustedPosition.y = Math.max(40, position.y); // At least 40px from top of viewport
  
  // Constrain x position to not exceed viewport
  const tooltipWidth = 140; // Approximate width
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
      className="selection-tooltip bg-white rounded-lg shadow-lg border border-indigo-200 text-sm py-1 px-1 animate-fadeIn"
      style={tooltipStyle}
    >
      <div className="flex">
        {defaultActions.map((action, index) => (
          <button
            key={index}
            className="px-3 py-1.5 hover:bg-indigo-50 rounded flex items-center gap-1.5 text-indigo-700 whitespace-nowrap transition-colors duration-150"
            onClick={() => action.onClick(selectedText)}
            title={`${action.label}: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`}
          >
            {action.icon && <span className="text-indigo-500">{action.icon}</span>}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
      {/* Triangle pointer */}
      <div 
        className="absolute w-3 h-3 bg-white border-b border-r border-indigo-200 transform rotate-45"
        style={{ 
          left: '50%', 
          bottom: '-6px', 
          marginLeft: '-6px'
        }}
      ></div>
    </div>
  );
};

export default TextSelectionTooltip;
