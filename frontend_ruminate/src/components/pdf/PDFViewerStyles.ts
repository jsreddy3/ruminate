// PDF Viewer Global Styles
export const pdfViewerGlobalStyles = `
  /* Hide PDF.js tooltips */
  .rpv-core__tooltip,
  [role="tooltip"] {
    display: none !important;
  }
  
  /* PDF viewer background styling for library feel */
  .rpv-core__viewer {
    background: linear-gradient(135deg, #fefcf7 0%, #fef9ed 100%) !important;
  }
  
  /* Page styling */
  .rpv-core__page-layer {
    box-shadow: 0 8px 16px rgba(60, 64, 67, 0.15), 0 4px 8px rgba(60, 64, 67, 0.1) !important;
    border-radius: 6px !important;
    border: 1px solid rgba(175, 95, 55, 0.1) !important;
  }
  
  /* Virtualized PDF viewer styles */
  .pdf-virtual-list {
    scrollbar-width: thin;
    scrollbar-color: rgba(175, 95, 55, 0.3) transparent;
  }
  
  .pdf-virtual-list::-webkit-scrollbar {
    width: 10px;
  }
  
  .pdf-virtual-list::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .pdf-virtual-list::-webkit-scrollbar-thumb {
    background-color: rgba(175, 95, 55, 0.3);
    border-radius: 5px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }
  
  .pdf-virtual-list::-webkit-scrollbar-thumb:hover {
    background-color: rgba(175, 95, 55, 0.5);
  }
  
  /* React-pdf page styles */
  .react-pdf__Page {
    position: relative !important;
  }
  
  .react-pdf__Page__canvas {
    box-shadow: 0 8px 16px rgba(60, 64, 67, 0.15), 0 4px 8px rgba(60, 64, 67, 0.1) !important;
    border-radius: 6px !important;
  }
  
  .react-pdf__Page__textContent {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
  }
`;