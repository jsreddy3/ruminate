import React from 'react';

interface TableGroupProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function TableGroup({ html_content, block_type, getBlockClassName }: TableGroupProps) {
  // Parse content refs from html_content
  const parseContentRefs = (content: string) => {
    const refs: string[] = [];
    const regex = /<content-ref src='([^']+)'><\/content-ref>/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      refs.push(match[1]);
    }
    
    return refs;
  };

  const contentRefs = parseContentRefs(html_content);
  
  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      <div className={`p-3 bg-neutral-50 text-neutral-800 rounded-lg border border-neutral-200 shadow-sm ${getBlockClassName(block_type)}`}>
        {/* We'll need to fetch and render the actual table and caption content */}
        <pre>{JSON.stringify(contentRefs, null, 2)}</pre>
      </div>
    </div>
  );
}
