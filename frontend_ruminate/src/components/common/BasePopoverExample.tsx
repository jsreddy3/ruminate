import React, { useState, useRef } from 'react';
import BasePopover from './BasePopover';

// Example component showing how to use BasePopover with side positioning
export default function BasePopoverExample() {
  const [showPopover, setShowPopover] = useState(false);
  const [placement, setPlacement] = useState<'auto' | 'left' | 'right'>('auto');
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="p-8">
      <h2 className="text-lg font-semibold mb-4">BasePopover Side Positioning Example</h2>
      
      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setPlacement('auto')}
          className={`px-3 py-1 rounded ${placement === 'auto' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Auto
        </button>
        <button
          onClick={() => setPlacement('left')}
          className={`px-3 py-1 rounded ${placement === 'left' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Left
        </button>
        <button
          onClick={() => setPlacement('right')}
          className={`px-3 py-1 rounded ${placement === 'right' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
        >
          Right
        </button>
      </div>

      <button
        ref={buttonRef}
        onClick={() => setShowPopover(!showPopover)}
        className="px-4 py-2 bg-library-sage-200 hover:bg-library-sage-300 rounded-lg transition-colors"
      >
        Toggle Popover
      </button>

      <BasePopover
        isVisible={showPopover}
        position={{ x: 0, y: 0 }} // Position is ignored when using anchorElement
        onClose={() => setShowPopover(false)}
        anchorElement={buttonRef.current}
        placement={placement}
        sideOffset={20}
        title="Comment"
        initialWidth={300}
        draggable={true}
        resizable={true}
      >
        <div className="p-4">
          <p className="text-sm text-gray-700 mb-3">
            This popover demonstrates Google Docs-style side positioning.
          </p>
          <textarea
            className="w-full h-20 p-2 border border-gray-300 rounded resize-none"
            placeholder="Add your comment here..."
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setShowPopover(false)}
              className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
            >
              Cancel
            </button>
            <button
              onClick={() => setShowPopover(false)}
              className="px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
            >
              Comment
            </button>
          </div>
        </div>
      </BasePopover>
    </div>
  );
}