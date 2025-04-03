import { motion } from 'framer-motion';

export default function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="space-y-4"
    >
      <h1 className="text-5xl font-bold text-neutral-800">
        Ruminate
      </h1>
      <p className="text-2xl font-medium text-neutral-600">
        The AI agent that reads between the lines
      </p>
      <p className="text-lg text-neutral-500 mt-4 max-w-xl mx-auto">
        Upload your document and watch our AI analyze and highlight key insights in real time.
      </p>
    </motion.div>
  );
}
