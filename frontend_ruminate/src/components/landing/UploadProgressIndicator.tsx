import { motion } from 'framer-motion';
import { ProcessingProgress } from '@/types';

interface UploadProgressIndicatorProps {
  progress: ProcessingProgress | null;
}

export default function UploadProgressIndicator({ progress }: UploadProgressIndicatorProps) {
  if (!progress) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mt-4 p-4 w-full max-w-md bg-neutral-100 rounded-lg shadow text-center"
    >
      <p className="text-sm font-semibold text-primary-700">{progress.status}</p>
      <p className="text-xs text-neutral-600 mt-1">{progress.detail}</p>
      {/* Optional: Add a visual progress bar based on status */}
      {/* Example: <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
                  <div className="bg-blue-600 h-2.5 rounded-full" style={{width: '45%'}}></div>
                 </div> */}
    </motion.div>
  );
}
