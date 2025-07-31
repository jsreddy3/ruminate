import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface IndicatorBadgeProps {
  type: 'icon' | 'dot';
  color: string;
  gradient?: string;
  glowColor?: string;
  icon?: React.ReactNode;
  title: string;
  delay?: number;
  position: { left: string; zIndex: number };
  isJustAdded?: boolean;
  isExpanded?: boolean;
}

const IndicatorBadge: React.FC<IndicatorBadgeProps> = ({
  type,
  color,
  gradient,
  glowColor,
  icon,
  title,
  delay = 0,
  position,
  isExpanded = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  if (type === 'dot') {
    return (
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2, delay }}
        className={`absolute w-2 h-2 rounded-full shadow-sm`}
        style={{ 
          backgroundColor: color,
          left: position.left,
          zIndex: position.zIndex
        }}
        title={title}
      />
    );
  }

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ 
        scale: isHovered ? 1.15 : 1,
        rotate: 0,
        x: 0
      }}
      transition={{ 
        type: "spring", 
        stiffness: 400, 
        damping: 25, 
        delay: isExpanded ? 0 : delay,
        scale: { duration: 0.2 },
        x: { type: "spring", stiffness: 300, damping: 30, duration: 0.4 }
      }}
      className="absolute cursor-pointer"
      style={{ 
        left: position.left,
        zIndex: position.zIndex
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        style={{
          width: '20px',
          height: '20px',
          background: gradient || color,
          borderRadius: '50%',
          border: '1.5px solid rgba(255, 255, 255, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 255, 255, 0.95)',
          boxShadow: isHovered 
            ? `0 2px 8px rgba(0, 0, 0, 0.25), 0 0 12px ${glowColor || 'rgba(0, 0, 0, 0.1)'}`
            : `0 2px 4px rgba(0, 0, 0, 0.15)`,
          transition: 'all 0.2s ease-out'
        }}
        title={title}
      >
        <div style={{
          filter: isHovered ? 'drop-shadow(0 1px 1px rgba(0, 0, 0, 0.4))' : 'none',
          transition: 'filter 0.2s ease-out'
        }}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
};

export default IndicatorBadge;