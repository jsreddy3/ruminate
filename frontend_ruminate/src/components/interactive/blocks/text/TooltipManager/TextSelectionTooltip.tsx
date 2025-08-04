import React, { useEffect, useRef } from 'react';
import { MessageSquarePlus, Search, FileText } from 'lucide-react';

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
  isOnboardingStep5?: boolean;
  isOnboardingStep6?: boolean;
  onCreateChatForOnboarding?: () => void;
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
  isOnboardingStep5 = false,
  isOnboardingStep6 = false,
  onCreateChatForOnboarding,
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Simple approach for managing tooltip visibility
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Don't close during onboarding step 5 or 6
      if (isOnboardingStep5 || isOnboardingStep6) return;
      
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
  }, [isVisible, onClose, isOnboardingStep5, isOnboardingStep6]);

  // Close tooltip when pressing Escape
  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      // Don't close during onboarding step 5 or 6
      if (isOnboardingStep5 || isOnboardingStep6) return;
      
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isVisible, onClose, isOnboardingStep5, isOnboardingStep6]);

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
      onClick: isOnboardingStep5 ? () => {} : safeExecute(onAddToChat), // Fake click during step 5
      disabled: isOnboardingStep6, // Only disable during onboarding step 6
    },
    ...( onCreateRabbithole ? [{
      label: 'Create chat',
      icon: <Search size={16} />,
      onClick: () => {
        // Close tooltip immediately for responsive feel
        if (isOnboardingStep6) {
          onClose();
        }
        
        if (onCreateRabbithole && (!isOnboardingStep5 || isOnboardingStep6)) {
          // For now, use dummy offsets - we'll need to get real ones from the selection
          onCreateRabbithole(selectedText, 0, selectedText.length);
        } 
        
        // Call onboarding handler if in step 6
        if (isOnboardingStep6 && onCreateChatForOnboarding) {
          onCreateChatForOnboarding();
        } 
      },
      disabled: false, // Don't disable during onboarding
      isHighlighted: isOnboardingStep6, // Highlight during onboarding step 6
    }] : []),
    ...( onDefine ? [{
      label: isDefining ? 'Defining...' : 'Key Term',
      icon: isDefining ? (
        <div className="animate-spin w-4 h-4 border-2 border-library-gold-600 border-t-transparent rounded-full" />
      ) : (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <text x="12" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" strokeWidth="0" fill="currentColor">Aa</text>
        </svg>
      ),
      onClick: isDefining ? undefined : isOnboardingStep5 ? () => {} : safeExecute(onDefine), // Fake click during step 5
      disabled: isDefining || isOnboardingStep6, // Only disable during onboarding step 6
    }] : []),
    ...( onAnnotate ? [{
      label: 'Annotate',
      icon: <FileText size={16} />,
      onClick: isOnboardingStep5 ? () => {} : safeExecute(onAnnotate), // Fake click during step 5
      disabled: isOnboardingStep6, // Only disable during onboarding step 6
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
      className={`selection-tooltip bg-gradient-to-br from-surface-paper to-library-cream-50 rounded-lg shadow-shelf border text-lg py-1 px-1 transition-all duration-200 ease-out hover:scale-105 group ${
        isOnboardingStep5 || isOnboardingStep6
          ? 'border-library-gold-400 shadow-2xl ring-2 ring-library-gold-400/20' 
          : 'border-library-sage-300'
      }`}
      style={tooltipStyle}
    >
      <div className="animate-fadeIn">
        <div className="flex">
          {defaultActions.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              onMouseUp={(e) => {
                // Use mouseup instead of onClick during onboarding steps 5 and 6
                if ((isOnboardingStep5 || isOnboardingStep6) && !action.disabled && action.onClick) {
                  e.preventDefault();
                  e.stopPropagation();
                  action.onClick();
                }
              }}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 whitespace-nowrap transition-all duration-200 font-serif relative ${
                action.disabled 
                  ? 'text-library-sage-400 cursor-not-allowed bg-library-sage-50 opacity-30' 
                  : action.isHighlighted
                    ? 'ring-4 ring-library-gold-400/70 shadow-2xl scale-110 hover:scale-115'
                    : 'hover:bg-library-gold-50 text-reading-secondary hover:text-reading-primary'
              }`}
              style={action.isHighlighted ? {
                background: 'linear-gradient(135deg, #f9cf5f 0%, #edbe51 100%)',
                color: '#2c3830',
                borderColor: '#f9cf5f',
                animation: 'glow 2s ease-in-out infinite',
                boxShadow: '0 0 25px rgba(249, 207, 95, 0.9), 0 0 50px rgba(249, 207, 95, 0.5)'
              } : {}}
              onClick={(e) => {
                if (!isOnboardingStep5 && !isOnboardingStep6 && !action.disabled && action.onClick) {
                  action.onClick();
                }
              }}
              disabled={action.disabled}
              title={
                action.isHighlighted 
                  ? 'Click here to define this term!' 
                  : action.disabled 
                    ? 'Generating definition...' 
                    : `${action.label}: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`
              }
            >
              {action.icon && (
                <span className={
                  action.disabled 
                    ? "text-library-sage-300" 
                    : action.isHighlighted
                      ? "text-library-mahogany-700"
                      : "text-library-mahogany-500"
                }>
                  {action.icon}
                </span>
              )}
              <span className="relative z-10">{action.label}</span>
            </button>
          ))}
        </div>
        {/* Triangle pointer */}
        <div 
          className={`absolute w-3 h-3 bg-gradient-to-br from-surface-paper to-library-cream-100 border-b border-r transform rotate-45 ${
            isOnboardingStep5 ? 'border-library-gold-400' : 'border-library-sage-300'
          }`}
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
