import { motion } from 'framer-motion';

export default function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="space-y-5"
    >
      <h1 className="text-5xl md:text-6xl font-serif font-medium text-ink-800 tracking-tight">
        Ruminate
      </h1>
      
      <p className="font-serif text-xl md:text-2xl text-ink-700 italic font-light">
        The AI agent that reads between the lines
      </p>
    </motion.div>
  );
}
