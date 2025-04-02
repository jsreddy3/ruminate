'use client';

import { useState, useEffect } from 'react';

interface ResizablePanelProps {
  children: React.ReactNode;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onResize?: (width: number) => void;
}

export default function ResizablePanel({
  children,
  width,
  minWidth = 320,
  maxWidth = 1280,
  onResize
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
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth, onResize]);

  return (
    <div style={{ width: `${width}px` }} className="relative h-full overflow-hidden">
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full cursor-ew-resize hover:bg-primary-500/50 transition-colors"
        onMouseDown={() => setIsResizing(true)}
      />
      {children}
    </div>
  );
} 