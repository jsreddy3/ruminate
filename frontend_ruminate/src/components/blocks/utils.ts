export const getBlockClassName = (block_type?: string): string => {
  if (!block_type) return '';
  
  const type = block_type.toLowerCase();
  switch (type) {
    case 'sectionheader':
      return 'text-2xl font-bold mb-4';
    case 'pageheader':
    case 'pagefooter':
      return 'text-sm text-neutral-600';
    case 'listitem':
      return 'ml-4 list-disc';
    case 'footnote':
      return 'text-sm text-neutral-700 border-t border-neutral-200 mt-4 pt-2';
    case 'reference':
      return 'text-sm text-neutral-600 font-mono';
    default:
      return '';
  }
};
