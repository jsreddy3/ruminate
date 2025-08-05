import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ImagePopoverProps {
  src: string;
  initialPosition: { x: number; y: number };
  onClose: () => void;
}

export default function ImagePopover({ src, initialPosition, onClose }: ImagePopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState({ width: 300, height: 200 }); // Initial size while loading
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 300, height: 200 });

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
    
    setIsDragging(true);
    setDragStart({ 
      x: e.clientX - position.x, 
      y: e.clientY - position.y 
    });
    e.preventDefault();
  };

  // Handle resizing
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  // Mouse move handler
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (isResizing) {
      const newWidth = Math.max(200, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(150, resizeStart.height + (e.clientY - resizeStart.y));
      setSize({ width: newWidth, height: newHeight });
    }
  };

  // Mouse up handler
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart]);

  // Handle image load to set initial size
  const handleImageLoad = () => {
    if (imageRef.current) {
      const img = imageRef.current;
      const maxWidth = window.innerWidth * 0.7;
      const maxHeight = window.innerHeight * 0.7;
      
      let width = img.naturalWidth;
      let height = img.naturalHeight;
      
      // Scale down if too large
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = width * scale;
        height = height * scale;
      }
      
      // Add some padding
      setSize({ width: width + 40, height: height + 40 });
      setImageLoaded(true);
    }
  };

  // Prevent overflow
  useEffect(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    setPosition(prev => ({
      x: Math.min(Math.max(20, prev.x), viewportWidth - size.width - 20),
      y: Math.min(Math.max(20, prev.y), viewportHeight - size.height - 20)
    }));
  }, [size]);

  return createPortal(
    <div
      ref={popoverRef}
      data-image-gallery="true"
      className="fixed bg-white rounded-lg shadow-2xl overflow-hidden"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 999999,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md transition-all"
        title="Close (Esc)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image */}
      <div className="w-full h-full flex items-center justify-center bg-gray-50 p-5">
        <img
          ref={imageRef}
          src={src}
          alt="Figure"
          className="max-w-full max-h-full object-contain"
          draggable={false}
          onLoad={handleImageLoad}
          style={{ opacity: imageLoaded ? 1 : 0 }}
        />
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-pulse text-gray-400">Loading...</div>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute bottom-1 right-1 w-0 h-0 border-l-2 border-b-2 border-gray-400 group-hover:border-gray-600"></div>
        <div className="absolute bottom-0.5 right-2 w-0 h-0 border-l-2 border-b-2 border-gray-400 group-hover:border-gray-600"></div>
        <div className="absolute bottom-2 right-0.5 w-0 h-0 border-l-2 border-b-2 border-gray-400 group-hover:border-gray-600"></div>
      </div>
    </div>,
    document.body
  );
}