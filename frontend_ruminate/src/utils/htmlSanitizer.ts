import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks while preserving safe formatting
 */
export class HTMLSanitizer {
  private static config = {
    // Allow basic formatting tags that are commonly used in PDF content
    ALLOWED_TAGS: [
      'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'a', 'img'
    ],
    
    // Allow safe attributes
    ALLOWED_ATTR: [
      'class', 'id', 'style', 'title', 'alt',
      'href', 'target', 'rel',
      'src', 'width', 'height',
      'colspan', 'rowspan'
    ],
    
    // Allow safe URL schemes for links and images
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    
    // Keep whitespace for formatting
    KEEP_CONTENT: true,
    
    // Return a document fragment instead of HTML string for better security
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM: false,
    
    // Additional security settings
    SANITIZE_DOM: true,
    SANITIZE_NAMED_PROPS: true,
    FORBID_CONTENTS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'meta', 'link'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit']
  };

  /**
   * Sanitizes HTML content for PDF-extracted text and blocks
   */
  static sanitizePDFContent(htmlContent: string): string {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return '';
    }

    // Preserve LaTeX delimiters by temporarily replacing them
    const latexPlaceholders = {
      '\\(': '___LATEX_INLINE_START___',
      '\\)': '___LATEX_INLINE_END___',
      '\\[': '___LATEX_BLOCK_START___',
      '\\]': '___LATEX_BLOCK_END___'
    };
    
    // Replace LaTeX delimiters with placeholders
    let content = htmlContent;
    Object.entries(latexPlaceholders).forEach(([delimiter, placeholder]) => {
      content = content.replace(new RegExp(delimiter.replace(/[\\[\]()]/g, '\\$&'), 'g'), placeholder);
    });

    // Additional security for PDF content - more restrictive
    const pdfConfig = {
      ...this.config,
      ALLOWED_TAGS: [
        'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u', 'sub', 'sup',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'math' // Allow math tags for LaTeX rendering
      ],
      ALLOWED_ATTR: ['class', 'style', 'display', 'block-type'] // Added display for math tags and block-type
    };

    // Sanitize the content
    const sanitized = DOMPurify.sanitize(content, pdfConfig);
    
    // Restore LaTeX delimiters
    let result = sanitized;
    Object.entries(latexPlaceholders).forEach(([delimiter, placeholder]) => {
      result = result.replace(new RegExp(placeholder, 'g'), delimiter);
    });

    return result;
  }

  /**
   * Sanitizes HTML content for chat messages with more permissive formatting
   */
  static sanitizeChatContent(htmlContent: string): string {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return '';
    }

    // Allow more formatting for chat messages but still secure
    const chatConfig = {
      ...this.config,
      ALLOWED_TAGS: [
        'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code', 'a'
      ],
      ALLOWED_ATTR: ['class', 'style', 'href', 'target', 'rel']
    };

    return DOMPurify.sanitize(htmlContent, chatConfig);
  }

  /**
   * Sanitizes HTML content for table data with table-specific tags
   */
  static sanitizeTableContent(htmlContent: string): string {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return '';
    }

    // Table-specific sanitization
    const tableConfig = {
      ...this.config,
      ALLOWED_TAGS: [
        'table', 'thead', 'tbody', 'tr', 'td', 'th',
        'p', 'div', 'span', 'br', 'strong', 'b', 'em', 'i', 'u'
      ],
      ALLOWED_ATTR: ['class', 'style', 'colspan', 'rowspan']
    };

    return DOMPurify.sanitize(htmlContent, tableConfig);
  }

  /**
   * Generic sanitizer for general HTML content
   */
  static sanitize(htmlContent: string): string {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return '';
    }

    return DOMPurify.sanitize(htmlContent, this.config);
  }

  /**
   * Strips all HTML tags and returns plain text
   */
  static stripHTML(htmlContent: string): string {
    if (!htmlContent || typeof htmlContent !== 'string') {
      return '';
    }

    return DOMPurify.sanitize(htmlContent, { 
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true 
    });
  }
}