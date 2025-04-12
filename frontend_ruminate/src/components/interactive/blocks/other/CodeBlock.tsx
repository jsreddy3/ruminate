interface CodeBlockProps {
  html_content: string;
  block_type: string;
  getBlockClassName: (block_type?: string) => string;
}

export default function CodeBlock({ html_content, block_type, getBlockClassName }: CodeBlockProps) {
  // Remove HTML tags and get pure text content
  const codeContent = html_content.replace(/<[^>]*>/g, '');

  return (
    <div className="p-4 border-b border-neutral-200 bg-white">
      <pre className={`p-3 bg-neutral-800 text-neutral-100 rounded-lg shadow-sm overflow-x-auto font-mono text-sm ${getBlockClassName(block_type)}`}>
        <code>{codeContent}</code>
      </pre>
    </div>
  );
}
