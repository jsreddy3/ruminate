'use client';

import { useState, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (width: number) => void;
  className?: string;
}

export default function ResizablePanel({
  children,
  width,
  minWidth = 320,
  maxWidth = 1280,
  onResize,
  className = ''
}: ResizablePanelProps) {
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.min(Math.max(minWidth, newWidth), maxWidth);
      onResize?.(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Restore normal text selection when resize is complete
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    if (isResizing) {
      // Prevent text selection during resize operation
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      // Clean up by restoring text selection
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth, onResize]);

  return (
    <div style={{ width: `${width}px` }} className={`relative h-full overflow-hidden ${className}`}>
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 w-4 h-full cursor-ew-resize hover:bg-primary-500/20 transition-colors"
        style={{ 
          userSelect: 'none',
          touchAction: 'none'
        }}
        onMouseDown={(e) => {
          e.preventDefault(); // Prevent text selection
          setIsResizing(true);
        }}
      />
      {children}
    </div>
  );
} 