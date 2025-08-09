import React, { useEffect, useRef, useState } from 'react';
import { useBlockImages } from '../../../../hooks/useBlockImages';
import { blocksActions } from '../../../../store/blocksStore';

interface PictureBlockProps {
  images: { [key: string]: string };
  blockId: string;
  documentId: string;
}

export default function PictureBlock({ images, blockId, documentId }: PictureBlockProps) {
  const [loadedImages, setLoadedImages] = useState(images);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { fetchBlockImages } = useBlockImages(documentId);
  
  // Intersection observer for visibility detection
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        rootMargin: '200px', // Start loading when within 200px of viewport
        threshold: 0.1
      }
    );
    
    observer.observe(containerRef.current);
    
    return () => observer.disconnect();
  }, []);
  
  // Lazy load images when visible
  useEffect(() => {
    if (!isVisible) return;
    
    const hasLazyImages = Object.values(images).some(img => img === "LAZY_LOAD");
    if (!hasLazyImages) {
      setLoadedImages(images);
      return;
    }
    
    fetchBlockImages(blockId).then(fetchedImages => {
      if (Object.keys(fetchedImages).length > 0) {
        const updatedImages = { ...images, ...fetchedImages };
        setLoadedImages(updatedImages);
        // Update store with loaded images
        blocksActions.setBlockImages(blockId, updatedImages);
      }
    }).catch(error => {
      console.error('Failed to load images for block', blockId, error);
    });
  }, [isVisible, images, blockId, fetchBlockImages]);
  if (!loadedImages || Object.keys(loadedImages).length === 0) {
    return (
      <div ref={containerRef} className="p-4 border-b border-neutral-200 bg-white">
        <div className="text-center text-gray-500 italic">
          📷 Picture block detected but no image data available
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-4 border-b border-neutral-200 bg-white">
      {Object.entries(loadedImages).map(([key, base64Data]) => (
        <div key={key} className="flex justify-center">
          {base64Data === "LAZY_LOAD" ? (
            <div className="w-full h-32 bg-gray-100 rounded-lg shadow-sm flex items-center justify-center animate-pulse">
              <span className="text-gray-400 text-sm">
                {isVisible ? 'Loading image...' : 'Image will load when visible'}
              </span>
            </div>
          ) : (
            <img 
              src={`data:image/jpeg;base64,${base64Data}`}
              alt="PDF content"
              className="max-w-full h-auto rounded-lg shadow-sm"
            />
          )}
        </div>
      ))}
    </div>
  );
}
