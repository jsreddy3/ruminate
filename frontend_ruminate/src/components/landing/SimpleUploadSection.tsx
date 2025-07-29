import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function SimpleUploadSection() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/home');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.2 }}
      className="space-y-8 w-full max-w-md mx-auto"
    >
      <div className="text-center">
        <motion.button
          onClick={handleGetStarted}
          className="px-8 py-4 bg-primary-600 text-white rounded-xl shadow-lg
                    hover:bg-primary-700 hover:shadow-xl
                    transition-all duration-200
                    flex items-center gap-3 group mx-auto"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-lg font-medium">
            Get Started
          </span>
          <svg
            className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}