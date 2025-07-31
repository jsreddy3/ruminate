import React from 'react';

interface FigureBlockProps {
  images: { [key: string]: string };
}

export default function FigureBlock({ images }: FigureBlockProps) {
  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      {Object.entries(images).map(([key, base64Data]) => (
        <div key={key} className="flex flex-col items-center">
          {base64Data === "LAZY_LOAD" ? (
            <div className="w-full h-32 bg-gray-100 rounded-lg shadow-sm flex items-center justify-center animate-pulse">
              <span className="text-gray-400 text-sm">Loading figure...</span>
            </div>
          ) : (
            <img 
              src={`data:image/jpeg;base64,${base64Data}`}
              alt="Figure content"
              className="max-w-full h-auto rounded-lg shadow-sm"
            />
          )}
          {/* Optional: Add figure caption or number if needed */}
          <div className="mt-2 text-sm text-neutral-600">
            Figure {key.split('/').pop()}
          </div>
        </div>
      ))}
    </div>
  );
} 