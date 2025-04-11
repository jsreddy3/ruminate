import React, { useRef, useEffect } from 'react';

interface DefinitionTooltipProps {
  isVisible: boolean;
  position: { x: number, y: number };
  term: string;
  onClose: () => void;
}

const DefinitionTooltip: React.FC<DefinitionTooltipProps> = ({
  isVisible,
  position,
  term,
  onClose
}) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the tooltip
  useEffect(() => {
    if (!isVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;
  
  // Adjust position to ensure tooltip is visible within viewport
  const adjustedX = Math.min(Math.max(120, position.x), window.innerWidth - 120);
  const adjustedY = Math.max(40, position.y);

  return (
    <div 
      ref={tooltipRef}
      className="fixed z-50 animate-fadeIn"
      style={{
        position: 'fixed',
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        transform: 'translate(-50%, -100%)',
        marginTop: '-6px',
        width: '240px',
        maxWidth: '70vw',
        padding: '0',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 5px 10px -5px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        fontFamily: "'Times New Roman', Times, serif",
        overflow: 'hidden'
      }}
    >
      {/* Close button (absolute positioned in corner) */}
      <button 
        onClick={onClose}
        style={{ 
          position: 'absolute',
          top: '2px',
          right: '2px',
          color: '#94a3b8', 
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          fontSize: '14px',
          padding: '2px',
          zIndex: 2
        }}
      >
        ✕
      </button>

      {/* Dictionary-style definition content */}
      <div style={{ padding: '6px 8px 4px' }}>
        {/* Term with highlight - left aligned */}
        <div style={{ 
          marginBottom: '4px', 
          paddingBottom: '3px', 
          borderBottom: '1px solid #fef3c7' 
        }}>
          <span style={{ 
            display: 'inline-block',
            padding: '1px 4px',
            fontSize: '1rem',
            fontWeight: 'bold',
            fontStyle: 'italic',
            backgroundColor: '#fef9c3',
            borderBottom: '1px solid #fde047',
            color: '#1e293b',
            lineHeight: '1.2',
            textDecoration: 'none'
          }}>
            {term}
          </span>
        </div>
        
        {/* Definition content - full width */}
        <div style={{ 
          fontSize: '0.8125rem', 
          color: '#334155', 
          lineHeight: '1.3', 
          padding: '0 2px' 
        }}>
          <p style={{ marginBottom: '0' }}>
            In the context of this document, refers to a specific concept related to the subject matter.
          </p>
        </div>
        

      </div>
      
      {/* Triangle pointer */}
      <div 
        style={{ 
          position: 'absolute',
          width: '10px',
          height: '10px',
          backgroundColor: 'white',
          borderBottom: '1px solid #e2e8f0',
          borderRight: '1px solid #e2e8f0',
          transform: 'rotate(45deg)',
          left: '50%', 
          bottom: '-5px', 
          marginLeft: '-5px'
        }}
      ></div>
    </div>
  );
};

export default DefinitionTooltip;
