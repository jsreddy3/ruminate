import React from 'react';
import { HTMLSanitizer } from '../../../../utils/htmlSanitizer';

interface TableProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function Table({ html_content, block_type, getBlockClassName }: TableProps) {
  // Sanitize table content to prevent XSS
  const sanitizedContent = HTMLSanitizer.sanitizeTableContent(html_content);

  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <div 
          className={`${getBlockClassName(block_type)} table-container`}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      </div>
      <style jsx global>{`
        .table-container table {
          width: 100%;
          border-collapse: collapse;
          margin: 0;
        }
        .table-container th,
        .table-container td {
          border: 1px solid #e5e7eb;
          padding: 0.75rem;
          text-align: left;
        }
        .table-container th {
          background-color: #f9fafb;
          font-weight: 600;
        }
        .table-container tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .table-container tr:hover {
          background-color: #f3f4f6;
        }
      `}</style>
    </div>
  );
}
