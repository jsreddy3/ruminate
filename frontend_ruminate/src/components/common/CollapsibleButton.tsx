"use client";

import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

interface CollapsibleButtonProps {
  /**
   * Current collapsed state
   */
  isCollapsed: boolean;
  
  /**
   * Function to toggle collapsed state
   */
  onToggle: () => void;
  
  /**
   * Position of the button (default: 'right')
   */
  position?: 'left' | 'right';
  
  /**
   * Optional class name for additional styling
   */
  className?: string;
  
  /**
   * Button size variant (default: 'medium')
   */
  size?: 'small' | 'medium' | 'large';
  
  /**
   * Color theme (default: 'primary')
   */
  variant?: 'primary' | 'neutral' | 'subtle';
}

/**
 * A stylish, animated collapsible button component for expanding and collapsing panels
 */
export default function CollapsibleButton({
  isCollapsed,
  onToggle,
  position = 'right',
  className = '',
  size = 'medium',
  variant = 'primary'
}: CollapsibleButtonProps) {
  // Size mappings
  const sizeClasses = {
    small: 'w-5 h-14',
    medium: 'w-6 h-18',
    large: 'w-7 h-22'
  };
  
  const iconSizes = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5'
  };
  
  // Variant mappings
  const variantClasses = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    neutral: 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200',
    subtle: 'bg-white/80 hover:bg-white text-neutral-600 border border-neutral-200'
  };
  
  // Position classes
  const positionClasses = {
    left: isCollapsed ? 'rounded-r-md' : 'rounded-l-md',
    right: isCollapsed ? 'rounded-l-md' : 'rounded-r-md'
  };
  
  return (
    <motion.button
      onClick={onToggle}
      className={`
        flex items-center justify-center shadow-sm backdrop-blur-sm
        ${sizeClasses[size]} 
        ${variantClasses[variant]} 
        ${positionClasses[position]}
        ${className}
      `}
      title={isCollapsed ? "Expand Panel" : "Collapse Panel"}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0.85 }}
      animate={{ 
        opacity: 1,
        x: isCollapsed ? 0 : 0 
      }}
      transition={{ duration: 0.15 }}
    >
      {isCollapsed ? (
        position === 'right' ? (
          <ChevronLeftIcon className={iconSizes[size]} />
        ) : (
          <ChevronRightIcon className={iconSizes[size]} />
        )
      ) : (
        position === 'right' ? (
          <ChevronRightIcon className={iconSizes[size]} />
        ) : (
          <ChevronLeftIcon className={iconSizes[size]} />
        )
      )}
    </motion.button>
  );
}