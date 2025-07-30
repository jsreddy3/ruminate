import React from 'react';
import { motion } from 'framer-motion';

interface IndicatorBadgeProps {
  type: 'icon' | 'dot';
  color: string;
  icon?: React.ReactNode;
  title: string;
  delay?: number;
  position: { left: string; zIndex: number };
}

const IndicatorBadge: React.FC<IndicatorBadgeProps> = ({
  type,
  color,
  icon,
  title,
  delay = 0,
  position
}) => {
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
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30, delay }}
      className="absolute"
      style={{ 
        left: position.left,
        zIndex: position.zIndex
      }}
    >
      <div 
        style={{
          width: '20px',
          height: '20px',
          backgroundColor: color,
          borderRadius: '50%',
          border: '2px solid white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
        }}
        title={title}
      >
        {icon}
      </div>
    </motion.div>
  );
};

export default IndicatorBadge;