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
  // Clean layout calculations for optimal spacing
  const offsetPixels = type === 'dot' ? 4 : 6; // Balanced spacing
  const baseSize = type === 'dot' ? 10 : 20; // Proper proportions
  const totalWidth = visibleCount > 0 ? baseSize + (visibleCount - 1) * offsetPixels : baseSize;
  
  // Get position classes
  const positionClasses = type === 'dot' ? DOT_POSITION_CLASSES[position] : POSITION_CLASSES[position];
  
  return (
    <div 
      className={`absolute ${positionClasses} pointer-events-none`} 
      style={{ 
        width: `${totalWidth}px`, 
        height: `${baseSize}px`,
        // Add subtle backdrop for better visual separation when multiple indicators present
        ...(visibleCount > 1 && type === 'icon' && {
          background: 'radial-gradient(ellipse 120% 80% at center, rgba(254, 252, 247, 0.15) 0%, transparent 70%)',
          borderRadius: '12px',
          backdropFilter: 'blur(1px)',
          padding: '2px'
        })
      }}
    >
      {children}
    </div>
  );
};

export default IndicatorLayout;