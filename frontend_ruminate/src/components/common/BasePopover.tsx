import React, { useRef, useEffect, ReactNode, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Grip } from 'lucide-react';

interface BasePopoverProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  children: ReactNode;
  
  // Customization options
  className?: string;
  showCloseButton?: boolean;
  closeOnClickOutside?: boolean;
  title?: string | React.ReactNode;
  
  // Drag & Resize options (like Notes)
  draggable?: boolean;
  resizable?: boolean;
  initialWidth?: number;
  initialHeight?: number | 'auto';
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: string;
  
  // Advanced positioning
  offsetX?: number;
  offsetY?: number;
  preventOverflow?: boolean;
  
  // Side positioning (like Google Docs comments)
  placement?: 'auto' | 'left' | 'right' | 'top' | 'bottom' | 'center';
  anchorElement?: HTMLElement | null;
  sideOffset?: number; // Distance from anchor when using side placement
}

const BasePopover: React.FC<BasePopoverProps> = ({
  isVisible,
  position,
  onClose,
  children,
  className = '',
  showCloseButton = true,
  closeOnClickOutside = true,
  title,
  draggable = false,
  resizable = false,
  initialWidth = 400,
  initialHeight = 'auto',
  minWidth = 200,
  minHeight = 150,
  maxWidth = 800,
  maxHeight = '90vh',
  offsetX = 0,
  offsetY = 0,
  preventOverflow = true,
  placement = 'center',
  anchorElement = null,
  sideOffset = 20,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  
  // EXACT copy from Notes implementation
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [popupSize, setPopupSize] = useState({ 
    width: initialWidth, 
    height: typeof initialHeight === 'number' ? initialHeight : 300 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [hasBeenResized, setHasBeenResized] = useState(false); // Track if user has resized
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: initialWidth, height: 300 });

  // EXACT copy: Mouse event handlers for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === popoverRef.current || (e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - popupPosition.x, y: e.clientY - popupPosition.y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPopupPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (isResizing) {
      const newWidth = Math.max(minWidth, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(minHeight, resizeStart.height + (e.clientY - resizeStart.y));
      setPopupSize({ width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  // EXACT copy: Resize handlers
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // If this is auto height and first resize, capture the actual rendered height
    let actualHeight = popupSize.height;
    if (initialHeight === 'auto' && !hasBeenResized && popoverRef.current) {
      actualHeight = popoverRef.current.offsetHeight;
      setPopupSize(prev => ({ ...prev, height: actualHeight }));
    }
    
    setIsResizing(true);
    setHasBeenResized(true); // Mark that user has started resizing
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: popupSize.width,
      height: actualHeight
    });
  };

  // EXACT copy: Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart, popupPosition, popupSize]);

  // Calculate position based on placement and anchor
  const calculatePosition = useCallback(() => {
    if (!isVisible) return { x: 0, y: 0 };

    let finalX = position.x + offsetX;
    let finalY = position.y + offsetY;

    // If we have an anchor element and side placement, calculate relative position
    if (anchorElement && placement !== 'center') {
      const anchorRect = anchorElement.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Determine placement
      let actualPlacement = placement;
      
      // Auto placement logic
      if (placement === 'auto') {
        const spaceLeft = anchorRect.left;
        const spaceRight = viewportWidth - anchorRect.right;
        
        // Choose side with more space
        actualPlacement = spaceRight >= spaceLeft ? 'right' : 'left';
      }
      
      // Calculate position based on placement
      switch (actualPlacement) {
        case 'left':
          finalX = anchorRect.left - popupSize.width - sideOffset;
          finalY = anchorRect.top;
          break;
        case 'right':
          finalX = anchorRect.right + sideOffset;
          finalY = anchorRect.top;
          break;
        case 'top':
          finalX = anchorRect.left;
          finalY = anchorRect.top - popupSize.height - sideOffset;
          break;
        case 'bottom':
          finalX = anchorRect.left;
          finalY = anchorRect.bottom + sideOffset;
          break;
      }
      
      // Adjust Y position to align with anchor vertically for side placements
      if (actualPlacement === 'left' || actualPlacement === 'right') {
        // Try to align top of popover with top of anchor
        finalY = anchorRect.top;
        
        // If popover would go below viewport, adjust up
        if (finalY + popupSize.height > viewportHeight - 20) {
          finalY = Math.max(20, viewportHeight - popupSize.height - 20);
        }
      }
    }

    // Apply overflow prevention
    if (preventOverflow) {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Prevent horizontal overflow
      if (finalX + popupSize.width > viewportWidth - 20) {
        finalX = viewportWidth - popupSize.width - 20;
      }
      if (finalX < 20) {
        finalX = 20;
      }

      // For auto height, just make sure we're not too close to the top
      if (initialHeight === 'auto') {
        if (finalY < 20) {
          finalY = 20;
        }
      } else {
        // Prevent vertical overflow (only if height is numeric)
        if (finalY + popupSize.height > viewportHeight - 20) {
          finalY = position.y - popupSize.height - 10; // Position above instead
        }
        if (finalY < 20) {
          finalY = 20;
        }
      }
    }

    return { x: finalX, y: finalY };
  }, [isVisible, position.x, position.y, offsetX, offsetY, preventOverflow, initialHeight, anchorElement, placement, sideOffset, popupSize]);

  // Initialize position when popup becomes visible
  useEffect(() => {
    if (isVisible) {
      const newPosition = calculatePosition();
      setPopupPosition(newPosition);
    }
  }, [isVisible, calculatePosition]);

  // Handle click outside to close
  useEffect(() => {
    if (!isVisible || !closeOnClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add slight delay to prevent immediate closure when opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, closeOnClickOutside, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isVisible) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  // EXACT copy from Notes: Render draggable/resizable version
  if (draggable || resizable) {
    return createPortal(
      <div
        ref={popoverRef}
        className={`fixed bg-gradient-to-br from-surface-paper to-library-cream-100 rounded-journal shadow-deep border border-library-sage-300 select-none backdrop-blur-paper ${(initialHeight === 'auto' && !hasBeenResized) ? '' : 'flex flex-col'} ${className}`}
        style={{
          left: `${popupPosition.x}px`,
          top: `${popupPosition.y}px`,
          width: `${popupSize.width}px`,
          height: (initialHeight === 'auto' && !hasBeenResized) ? 'auto' : `${popupSize.height}px`,
          zIndex: 999999,
          cursor: isDragging ? 'grabbing' : 'default',
          // Add subtle paper texture
          background: 'linear-gradient(135deg, #fefcf7 0%, #fcf0d2 50%, #fef9ed 100%), repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(175, 95, 55, 0.01) 35px, rgba(175, 95, 55, 0.01) 70px)'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Elegant scholarly header */}
        <div 
          className="drag-handle px-5 py-4 border-b border-library-sage-200 flex items-center justify-between bg-gradient-to-r from-library-cream-50 via-surface-parchment to-library-cream-50 rounded-t-journal cursor-grab active:cursor-grabbing backdrop-blur-sm"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Grip className="w-4 h-4 text-library-sage-400 flex-shrink-0" />
            {title && (
              <h3 className="font-serif text-sm font-semibold text-reading-primary overflow-hidden whitespace-nowrap text-ellipsis">
                {title}
              </h3>
            )}
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()} // Prevent close button from triggering drag
              className="text-library-sage-400 hover:text-reading-secondary transition-all duration-200 p-1.5 rounded-book hover:bg-library-cream-100 shadow-paper hover:shadow-book flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div 
          className={(initialHeight === 'auto' && !hasBeenResized) ? '' : 'overflow-y-auto flex-1'}
          style={(initialHeight === 'auto' && !hasBeenResized) ? {} : { 
            height: `${popupSize.height - 60}px` // Account for header
          }}
        >
          {children}
        </div>

        {/* EXACT copy: Resize handle */}
        {resizable && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-50 hover:opacity-100 transition-opacity"
            onMouseDown={handleResizeStart}
          >
            <div className="absolute bottom-1 right-1 w-0 h-0 border-l-2 border-b-2 border-gray-400"></div>
            <div className="absolute bottom-0.5 right-2 w-0 h-0 border-l-2 border-b-2 border-gray-400"></div>
            <div className="absolute bottom-2 right-0.5 w-0 h-0 border-l-2 border-b-2 border-gray-400"></div>
          </div>
        )}
      </div>,
      document.body
    );
  }

  // Render static version
  const staticPosition = calculatePosition();

  return createPortal(
    <div
      className="fixed z-50"
      style={{
        left: staticPosition.x,
        top: staticPosition.y,
        transform: 'translateZ(0)', // Force hardware acceleration
      }}
    >
      <div
        ref={popoverRef}
        className={`bg-gradient-to-br from-surface-paper to-library-cream-100 rounded-journal shadow-shelf border border-library-sage-300 backdrop-blur-paper ${className}`}
        style={{
          width: initialWidth,
          height: initialHeight === 'auto' ? 'auto' : initialHeight,
          maxHeight: maxHeight,
          // Add subtle paper texture
          background: 'linear-gradient(135deg, #fefcf7 0%, #fcf0d2 50%, #fef9ed 100%), repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(175, 95, 55, 0.01) 35px, rgba(175, 95, 55, 0.01) 70px)'
        }}
      >
        {/* Elegant header with title and close button */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-library-sage-200 bg-gradient-to-r from-library-cream-50 via-surface-parchment to-library-cream-50 rounded-t-journal">
            <div className="flex items-center space-x-3 min-w-0">
              {title && (
                <h3 className="font-serif text-sm font-semibold text-reading-primary overflow-hidden whitespace-nowrap text-ellipsis">
                  {title}
                </h3>
              )}
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-library-sage-400 hover:text-reading-secondary transition-all duration-200 p-1.5 rounded-book hover:bg-library-cream-100 shadow-paper hover:shadow-book"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BasePopover;