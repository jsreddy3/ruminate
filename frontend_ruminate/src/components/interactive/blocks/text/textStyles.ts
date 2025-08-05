/**
 * Text rendering styles for different block types and HTML elements
 */

export const getBlockTypeStyles = (blockType: string): React.CSSProperties => {
  const type = blockType.toLowerCase();
  
  switch (type) {
    case 'section_header':
      return {
        fontSize: '1.4rem',
        fontWeight: 700,
        marginBottom: '1rem',
        marginTop: '1.5rem',
        lineHeight: 1.3,
      };
      
    case 'caption':
      return {
        fontSize: '0.9rem',
        textAlign: 'center',
        color: '#6b7280',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
      };
      
    case 'footnote':
      return {
        fontSize: '0.85rem',
        borderLeft: '3px solid #e5e7eb',
        paddingLeft: '1rem',
        marginLeft: '0.5rem',
        color: '#4b5563',
      };
      
    case 'page_header':
    case 'page_footer':
      return {
        fontSize: '0.875rem',
        color: '#9ca3af',
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: '1rem',
        marginBottom: '1rem',
      };
      
    case 'list_item':
      return {
        marginLeft: '1.5rem',
        marginBottom: '0.25rem',
      };
      
    case 'reference':
      return {
        fontSize: '0.9rem',
        color: '#4b5563',
        borderLeft: '2px solid #d1d5db',
        paddingLeft: '0.75rem',
      };
      
    default:
      return {};
  }
};

export const baseTextStyles: React.CSSProperties = {
  fontFamily: '"Iowan Old Style", "Crimson Text", Georgia, "Times New Roman", serif',
  fontSize: '1.05rem',
  lineHeight: '1.65',
  color: '#1f2937',
  textAlign: 'justify',
  textRendering: 'optimizeLegibility',
  WebkitFontSmoothing: 'antialiased',
  MozOsxFontSmoothing: 'grayscale',
};

export const containerStyles: React.CSSProperties = {
  padding: '1rem',
  backgroundColor: '#fffdf7',
  border: '1px solid #fbbf24',
  borderRadius: '0.5rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  background: 'linear-gradient(to right, rgba(255,253,242,1) 0%, rgba(255,251,235,1) 100%)',
};