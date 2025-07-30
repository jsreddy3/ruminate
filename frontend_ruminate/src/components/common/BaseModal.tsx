import React, { useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BaseModalProps {
  isVisible: boolean;
  onClose: () => void;
  children: ReactNode;
  
  // Customization options
  className?: string;
  showCloseButton?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  title?: string;
  maxWidth?: string;
  
  // Background overlay
  showBackdrop?: boolean;
  backdropClassName?: string;
}

const BaseModal: React.FC<BaseModalProps> = ({
  isVisible,
  onClose,
  children,
  className = '',
  showCloseButton = true,
  closeOnClickOutside = true,
  closeOnEscape = true,
  title,
  maxWidth = 'max-w-sm',
  showBackdrop = true,
  backdropClassName = 'bg-black bg-opacity-30',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!isVisible || !closeOnClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible, closeOnClickOutside, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isVisible || !closeOnEscape) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, closeOnEscape, onClose]);

  if (!isVisible) return null;

  const modalContent = (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${showBackdrop ? backdropClassName : ''}`}>
      <div
        ref={modalRef}
        className={`bg-white rounded-lg shadow-lg border border-gray-200 w-full ${maxWidth} mx-4 ${className}`}
      >
        {/* Header with title and close button */}
        {(title || showCloseButton) && (
          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
            {title && (
              <h3 className="font-medium text-gray-900">{title}</h3>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
        
        {/* Content */}
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default BaseModal;