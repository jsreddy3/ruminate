import React from 'react';
import { POSITION_CLASSES, DOT_POSITION_CLASSES } from './indicatorConfig';

interface IndicatorLayoutProps {
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  type: 'icon' | 'dot';
  visibleCount: number;
  children: React.ReactNode;
}

const IndicatorLayout: React.FC<IndicatorLayoutProps> = ({
  position,
  type,
  visibleCount,
  children
}) => {
  // Calculate layout dimensions
  const offsetPixels = type === 'dot' ? 3 : 6;
  const baseSize = type === 'dot' ? 8 : 20; // dot size vs icon size
  const totalWidth = visibleCount > 0 ? baseSize + (visibleCount - 1) * offsetPixels : baseSize;
  
  // Get position classes
  const positionClasses = type === 'dot' ? DOT_POSITION_CLASSES[position] : POSITION_CLASSES[position];
  
  return (
    <div 
      className={`absolute ${positionClasses} pointer-events-none`} 
      style={{ 
        width: `${totalWidth}px`, 
        height: `${baseSize}px` 
      }}
    >
      {children}
    </div>
  );
};

export default IndicatorLayout;