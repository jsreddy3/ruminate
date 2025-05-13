import { motion } from 'framer-motion';
import { ProcessingProgress } from '@/types';

interface UploadProgressIndicatorProps {
  progress: ProcessingProgress | null;
}

export default function UploadProgressIndicator({ progress }: UploadProgressIndicatorProps) {
  if (!progress) {
    return null;
  }

  // Determine how to display progress based on status
  const getProgressWidth = () => {
    if (progress.status.toLowerCase().includes('complete')) return '100%';
    
    // Extract percentage if it exists in the status message
    const percentMatch = progress.status.match(/(\d+)%/);
    if (percentMatch && percentMatch[1]) {
      return `${percentMatch[1]}%`;
    }
    
    // Default to indeterminate progress for stages without clear percentage
    return '60%';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-4 p-4 w-full max-w-md bg-paper-50 border border-paper-200 rounded-md shadow-sm text-center"
    >
      <p className="font-serif text-sm font-medium text-ink-800">{progress.status}</p>
      <p className="text-xs text-ink-600 mt-1 font-light">{progress.detail}</p>
      
      {/* Simple progress bar */}
      <div className="w-full h-px bg-paper-200 mt-3 overflow-hidden">
        <motion.div 
          className="h-full bg-terracotta-400"
          initial={{ width: 0 }}
          animate={{ width: getProgressWidth() }}
          transition={{ 
            duration: progress.status.toLowerCase().includes('complete') ? 0.5 : 2,
            ease: "easeInOut"
          }}
        />
      </div>
    </motion.div>
  );
}
