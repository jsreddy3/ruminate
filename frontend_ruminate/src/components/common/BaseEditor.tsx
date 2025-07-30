import React, { ReactNode } from 'react';
import { Save, X, Trash2, Loader } from 'lucide-react';

interface BaseEditorProps {
  children: ReactNode;
  
  // Editor state
  isLoading?: boolean;
  hasChanges?: boolean;
  
  // Actions
  onSave?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
  
  // Button customization
  saveText?: string;
  cancelText?: string;
  deleteText?: string;
  
  // Styling
  className?: string;
  showSaveIcon?: boolean;
  showCancelIcon?: boolean;
  showDeleteIcon?: boolean;
  
  // Layout customization
  showDefaultButtons?: boolean;
  customFooter?: ReactNode;
  footerClassName?: string;
}

const BaseEditor: React.FC<BaseEditorProps> = ({
  children,
  isLoading = false,
  hasChanges = false,
  onSave,
  onCancel,
  onDelete,
  saveText = 'Save',
  cancelText = 'Cancel',
  deleteText = 'Delete',
  className = '',
  showSaveIcon = true,
  showCancelIcon = true,
  showDeleteIcon = true,
  showDefaultButtons = true,
  customFooter,
  footerClassName = '',
}) => {
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Content */}
      <div className="p-3 flex-1 flex flex-col">
        {children}
      </div>
      
      {/* Footer - either custom or default buttons */}
      {customFooter ? (
        customFooter
      ) : showDefaultButtons ? (
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            {/* Save button */}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isLoading || !hasChanges}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  showSaveIcon && <Save className="w-3 h-3" />
                )}
                <span>{saveText}</span>
              </button>
            )}
            
            {/* Cancel button */}
            {onCancel && (
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
              >
                {showCancelIcon && <X className="w-3 h-3" />}
                <span>{cancelText}</span>
              </button>
            )}
          </div>
          
          {/* Delete button */}
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isLoading}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-100 text-red-700 text-sm rounded-md hover:bg-red-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
            >
              {showDeleteIcon && <Trash2 className="w-3 h-3" />}
              <span>{deleteText}</span>
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default BaseEditor;