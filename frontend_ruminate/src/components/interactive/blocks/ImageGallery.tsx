import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronRight, ChevronLeft, Images } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Block } from '../../pdf/PDFViewer';
import ImagePopover from './ImagePopover';

interface ImageGalleryProps {
  blocks: Block[];
  currentBlockId: string;
  documentId: string;
  onImageFetch: (blockId: string) => Promise<{ [key: string]: string }>;
}

interface ImageData {
  blockId: string;
  blockType: string;
  images: { [key: string]: string };
  pageNumber?: number;
}

export default function ImageGallery({ 
  blocks, 
  currentBlockId, 
  documentId,
  onImageFetch 
}: ImageGalleryProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [loadedImages, setLoadedImages] = useState<Map<string, ImageData>>(new Map());
  const [selectedImages, setSelectedImages] = useState<Array<{
    id: string;
    src: string;
    blockId: string;
    key: string;
    position: { x: number; y: number };
  }>>([]);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Find current block index
  const currentIndex = useMemo(() => 
    blocks.findIndex(block => block.id === currentBlockId),
    [blocks, currentBlockId]
  );

  // Get blocks within ±5 range that have images
  const nearbyImageBlocks = useMemo(() => {
    const start = Math.max(0, currentIndex - 5);
    const end = Math.min(blocks.length - 1, currentIndex + 5);
    
    return blocks.slice(start, end + 1).filter(block => {
      const blockType = block.block_type.toLowerCase();
      return ['picture', 'figure', 'image'].includes(blockType);
    });
  }, [blocks, currentIndex]);

  // Load images for nearby blocks
  useEffect(() => {
    const loadImages = async () => {
      for (const block of nearbyImageBlocks) {
        // Skip if already loaded
        if (loadedImages.has(block.id)) continue;

        // Check if block already has images
        if (block.images && Object.keys(block.images).length > 0) {
          // Skip LAZY_LOAD placeholders
          const hasRealImages = Object.values(block.images).some(img => img !== "LAZY_LOAD");
          if (hasRealImages) {
            setLoadedImages(prev => new Map(prev).set(block.id, {
              blockId: block.id,
              blockType: block.block_type,
              images: block.images,
              pageNumber: block.page_number
            }));
            continue;
          }
        }

        // Fetch images
        try {
          const images = await onImageFetch(block.id);
          if (images && Object.keys(images).length > 0) {
            setLoadedImages(prev => new Map(prev).set(block.id, {
              blockId: block.id,
              blockType: block.block_type,
              images: images,
              pageNumber: block.page_number
            }));
          }
        } catch (error) {
          console.error(`Failed to load images for block ${block.id}:`, error);
        }
      }
    };

    loadImages();
  }, [nearbyImageBlocks, onImageFetch]);

  // Handle thumbnail click
  const handleThumbnailClick = (imageData: ImageData, imageKey: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const imageSrc = imageData.images[imageKey];
    
    // Ensure we have the full base64 data URL
    const fullSrc = imageSrc.startsWith('data:') 
      ? imageSrc 
      : `data:image/jpeg;base64,${imageSrc}`;
    
    // Add a new image to the array with a unique ID
    const newImage = {
      id: `${imageData.blockId}-${imageKey}-${Date.now()}`,
      src: fullSrc,
      blockId: imageData.blockId,
      key: imageKey,
      position: {
        x: rect.right + 10 + (selectedImages.length * 20), // Offset each new image
        y: rect.top + (selectedImages.length * 20)
      }
    };
    setSelectedImages(prev => [...prev, newImage]);
  };

  return (
    <>
      {/* Floating collapsible gallery */}
      {createPortal(
        <div 
          ref={galleryRef}
          data-image-gallery="true"
          className={`fixed left-0 top-1/2 -translate-y-1/2 transition-all duration-300 ${
            isCollapsed ? 'w-12' : 'w-48'
          }`}
          style={{
            zIndex: 999999,
            transform: 'translate3d(0, -50%, 0)' // Force GPU acceleration
          }}
        >
          <div className="bg-white shadow-xl rounded-r-lg border border-l-0 border-gray-200 h-[400px] flex">
            {/* Gallery content */}
            <div className={`${isCollapsed ? 'w-0' : 'w-36'} overflow-hidden transition-all duration-300`}>
              <div className="p-2 h-full flex flex-col">
                <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                  <Images size={12} />
                  <span>Nearby Figures</span>
                </div>
                
                {/* Scrollable thumbnails */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {nearbyImageBlocks.map(block => {
                    const imageData = loadedImages.get(block.id);
                    if (!imageData) {
                      return (
                        <div key={block.id} className="aspect-square bg-gray-100 rounded animate-pulse" />
                      );
                    }

                    return Object.entries(imageData.images).map(([key, base64]) => {
                      if (base64 === "LAZY_LOAD") return null;
                      
                      const thumbnailSrc = base64.startsWith('data:') 
                        ? base64 
                        : `data:image/jpeg;base64,${base64}`;
                      
                      return (
                        <div
                          key={`${block.id}-${key}`}
                          className="cursor-pointer hover:ring-2 hover:ring-amber-400 rounded transition-all"
                          onClick={(e) => handleThumbnailClick(imageData, key, e)}
                        >
                          <img
                            src={thumbnailSrc}
                            alt={`Figure from block ${block.id}`}
                            className="w-full h-auto rounded shadow-sm"
                          />
                          <div className="text-xs text-gray-500 mt-1 text-center">
                            {imageData.pageNumber ? `Page ${imageData.pageNumber}` : imageData.blockType}
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              </div>
            </div>

            {/* Toggle button */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-12 h-full bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-center border-l border-gray-200"
              title={isCollapsed ? "Show image gallery" : "Hide image gallery"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5 text-gray-600" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Floating image popovers - multiple can be open */}
      {selectedImages.map((image) => (
        <ImagePopover
          key={image.id}
          src={image.src}
          initialPosition={image.position}
          onClose={() => {
            setSelectedImages(prev => prev.filter(img => img.id !== image.id));
          }}
        />
      ))}
    </>
  );
}