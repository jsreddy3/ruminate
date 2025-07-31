import React from 'react';
import { POSITION_CLASSES, DOT_POSITION_CLASSES } from './indicatorConfig';

interface IndicatorLayoutProps {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  type: 'icon' | 'dot';
  visibleCount: number;
  children: React.ReactNode;
  isExpanded?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const IndicatorLayout: React.FC<IndicatorLayoutProps> = ({
  position,
  type,
  visibleCount,
  children,
  isExpanded = false,
  onMouseEnter,
  onMouseLeave
}) => {
  // Clean layout calculations for optimal spacing
  const offsetPixels = type === 'dot' ? 4 : 6; // Balanced spacing
  const expandedOffsetPixels = type === 'dot' ? 8 : 28; // Expanded spacing
  const baseSize = type === 'dot' ? 10 : 20; // Proper proportions
  const currentOffsetPixels = isExpanded ? expandedOffsetPixels : offsetPixels;
  const totalWidth = visibleCount > 0 ? baseSize + (visibleCount - 1) * currentOffsetPixels : baseSize;
  
  // Get position classes
  const positionClasses = type === 'dot' ? DOT_POSITION_CLASSES[position] : POSITION_CLASSES[position];
  
  return (
    <div 
      className={`absolute ${positionClasses} pointer-events-auto`} 
      style={{ 
        width: `${totalWidth}px`, 
        height: `${baseSize}px`,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        // Add enhanced backdrop for better visual separation when expanded
        ...(visibleCount > 1 && type === 'icon' && {
          background: isExpanded 
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(248, 250, 252, 0.85) 100%)'
            : 'transparent',
          borderRadius: isExpanded ? '16px' : '12px',
          backdropFilter: isExpanded ? 'blur(8px)' : 'none',
          border: isExpanded ? '1px solid rgba(255, 255, 255, 0.3)' : 'none',
          boxShadow: isExpanded 
            ? '0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.4)'
            : 'none',
          padding: isExpanded ? '6px' : '2px'
        })
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};

export default IndicatorLayout;