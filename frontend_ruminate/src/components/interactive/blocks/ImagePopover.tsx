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
    // Don't start dragging if clicking on resize handle
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
    
    // Don't start dragging if clicking on close button or its children
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    
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
      
      // Add padding for the header and frame
      setSize({ width: width + 40, height: height + 60 }); // Extra height for header
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
      className="fixed bg-gradient-to-br from-surface-paper via-library-cream-50 to-surface-parchment rounded-journal shadow-deep border border-library-sage-300 overflow-hidden backdrop-blur-paper hover:shadow-shelf"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        zIndex: 999999,
        cursor: isDragging ? 'grabbing' : 'move',
        background: 'linear-gradient(135deg, #fefcf7 0%, #fcf0d2 50%, #fef9ed 100%), repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(175, 95, 55, 0.01) 35px, rgba(175, 95, 55, 0.01) 70px)'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Elegant header bar */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-r from-library-cream-50/90 via-surface-parchment/90 to-library-cream-50/90 backdrop-blur-sm border-b border-library-sage-200 flex items-center justify-end px-3 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="text-library-sage-400 hover:text-reading-secondary p-1 rounded-book hover:bg-library-cream-100 relative z-20"
          title="Close (Esc)"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Image container with scholarly frame */}
      <div className="w-full h-full flex items-center justify-center pt-8">
        <div className="relative p-4 w-full h-full flex items-center justify-center">
          <img
            ref={imageRef}
            src={src}
            alt="Figure"
            className="max-w-full max-h-full object-contain rounded-paper shadow-paper"
            draggable={false}
            onLoad={handleImageLoad}
            style={{ 
              opacity: imageLoaded ? 1 : 0
            }}
          />
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-xs font-serif text-reading-muted animate-parchment-shimmer">Loading figure...</div>
            </div>
          )}
        </div>
      </div>

      {/* Resize handle with scholarly styling */}
      <div
        className="resize-handle absolute bottom-0 right-0 w-5 h-5 cursor-se-resize group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute bottom-1.5 right-1.5 w-0 h-0 border-l-[3px] border-b-[3px] border-library-sage-400 group-hover:border-library-gold-500 rounded-sm"></div>
        <div className="absolute bottom-1 right-2.5 w-0 h-0 border-l-2 border-b-2 border-library-sage-300 group-hover:border-library-gold-400"></div>
        <div className="absolute bottom-2.5 right-1 w-0 h-0 border-l-2 border-b-2 border-library-sage-300 group-hover:border-library-gold-400"></div>
      </div>
    </div>,
    document.body
  );
}