import React from 'react';
import { Worker, Viewer, SpecialZoomLevel, ScrollMode } from "@react-pdf-viewer/core";
import { PluginOnDocumentLoad, PluginOnPageChange } from "@react-pdf-viewer/core";

interface PDFDocumentViewerProps {
  pdfFile: string;
  forceRefreshKey: number;
  plugins: any[];
  onDocumentLoad: (e: PluginOnDocumentLoad) => void;
  onPageChange: (e: PluginOnPageChange) => void;
  renderLoader: (percentages: number) => React.ReactNode;
  renderPage: (props: any) => React.ReactNode;
  pdfLoadingState: 'idle' | 'loading' | 'loaded' | 'error' | 'stuck';
  onViewerReady?: (viewer: any) => void;
}

const PDFDocumentViewer: React.FC<PDFDocumentViewerProps> = ({
  pdfFile,
  forceRefreshKey,
  plugins,
  onDocumentLoad,
  onPageChange,
  renderLoader,
  renderPage,
  pdfLoadingState,
  onViewerReady,
}) => {
  // Page layout customization
  const pageLayout = {
    buildPageStyles: () => ({
      boxShadow: '0 0 4px rgba(0, 0, 0, 0.15)',
      margin: '16px auto',
      borderRadius: '4px',
    }),
    transformSize: ({ size }: { size: { width: number; height: number } }) => ({
      height: size.height,
      width: size.width,
    }),
  };

  return (
    <div className="h-full w-full overflow-hidden">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <div 
          style={{
            border: 'none',
            height: '100%',
            width: '100%',
            backgroundColor: 'white',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            padding: 0
          }}
          className="overflow-auto"
        >
          <Viewer
            key={forceRefreshKey}
            fileUrl={pdfFile}
            plugins={plugins}
            defaultScale={SpecialZoomLevel.PageFit}
            scrollMode={ScrollMode.Vertical}
            theme="light"
            pageLayout={pageLayout}
            onDocumentLoad={(e) => {
              onDocumentLoad(e);
              // Pass viewer functions for scroll-to-block functionality
              if (onViewerReady) {
                onViewerReady(e);
              }
            }}
            onPageChange={onPageChange}
            renderLoader={renderLoader}
            renderPage={renderPage}
          />
        </div>
      </Worker>
    </div>
  );
};

export default PDFDocumentViewer;