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
`;