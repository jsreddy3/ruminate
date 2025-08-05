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

  // Get blocks within ±10 range that have images
  const nearbyImageBlocks = useMemo(() => {
    const start = Math.max(0, currentIndex - 10);
    const end = Math.min(blocks.length - 1, currentIndex + 10);
    
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
  }, [nearbyImageBlocks, onImageFetch, loadedImages]); // Added loadedImages dependency

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
          <div className="bg-gradient-to-br from-surface-paper to-library-cream-100 shadow-shelf rounded-r-journal border border-l-0 border-library-sage-300 h-[400px] flex backdrop-blur-paper">
            {/* Gallery content */}
            <div className={`${isCollapsed ? 'w-0' : 'w-36'} overflow-hidden transition-all duration-300`}>
              <div className="p-3 h-full flex flex-col">
                <div className="text-xs font-serif text-reading-secondary mb-3 flex items-center gap-1.5">
                  <Images size={14} className="text-library-gold-600" />
                  <span className="font-medium">Figures</span>
                </div>
                
                {/* Scrollable thumbnails */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-library-sage-300 scrollbar-track-transparent">
                  {nearbyImageBlocks.map(block => {
                    const imageData = loadedImages.get(block.id);
                    if (!imageData) {
                      return (
                        <div key={block.id} className="aspect-square bg-library-cream-200 rounded-book animate-pulse shadow-paper" />
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
                          className="cursor-pointer group transition-all duration-200 hover:scale-105"
                          onClick={(e) => handleThumbnailClick(imageData, key, e)}
                        >
                          <div className="relative overflow-hidden rounded-book shadow-paper hover:shadow-book transition-shadow duration-200">
                            <img
                              src={thumbnailSrc}
                              alt={`Figure from block ${block.id}`}
                              className="w-full h-auto"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            <div className="absolute inset-0 ring-2 ring-library-gold-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-book" />
                          </div>
                          <div className="text-[10px] font-serif text-reading-muted mt-1.5 text-center">
                            {imageData.pageNumber ? `p. ${imageData.pageNumber}` : 'Figure'}
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
              className="w-12 h-full bg-gradient-to-r from-library-cream-50 to-surface-parchment hover:from-library-cream-100 hover:to-library-cream-50 transition-all duration-200 flex items-center justify-center border-l border-library-sage-300 group"
              title={isCollapsed ? "Show figure gallery" : "Hide figure gallery"}
            >
              {isCollapsed ? (
                <ChevronRight className="w-5 h-5 text-library-sage-600 group-hover:text-reading-secondary transition-colors" />
              ) : (
                <ChevronLeft className="w-5 h-5 text-library-sage-600 group-hover:text-reading-secondary transition-colors" />
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