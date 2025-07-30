import React from 'react';
import { PanelResizeHandle } from 'react-resizable-panels';

/**
 * Vertical resize handle with hover effects and visual indicators
 * Used for left-right panel resizing
 */
export const ResizeHandle: React.FC = () => (
  <PanelResizeHandle
    className="w-2 relative flex items-center justify-center hover:bg-gray-200 transition-colors"
  >
    <div className="absolute h-16 w-1 flex flex-col items-center justify-center space-y-1">
      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
      <div className="w-1 h-1 rounded-full bg-gray-300"></div>
    </div>
  </PanelResizeHandle>
);

/**
 * Horizontal resize handle with hover effects and visual indicators
 * Used for top-bottom panel resizing
 */
export const HorizontalResizeHandle: React.FC = () => (
  <PanelResizeHandle
    className="h-2 relative flex items-center justify-center hover:bg-gray-200 transition-colors"
  >
    <div className="absolute w-16 h-1 flex flex-row items-center justify-center space-x-1">
      <div className="h-1 w-1 rounded-full bg-gray-300"></div>
      <div className="h-1 w-1 rounded-full bg-gray-300"></div>
      <div className="h-1 w-1 rounded-full bg-gray-300"></div>
    </div>
  </PanelResizeHandle>
);