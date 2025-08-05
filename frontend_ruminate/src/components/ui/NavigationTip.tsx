import React, { useEffect, useState } from 'react';

interface NavigationTipProps {
  show: boolean;
  onClose: () => void;
  x: number;
  y: number;
}

export default function NavigationTip({ show, onClose, x, y }: NavigationTipProps) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Auto-hide after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      className="fixed z-50 bg-library-gold-600 text-white px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: Math.min(x, window.innerWidth - 250), // Prevent overflow
        top: y - 10,
        transform: 'translateY(-100%)'
      }}
    >
      <div className="flex items-center gap-2">
        <span>💡</span>
        <span>Tip: Use arrow keys for smoother stack navigation!</span>
      </div>
      {/* Small arrow pointing down */}
      <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-library-gold-600"></div>
    </div>
  );
}