import { motion } from 'framer-motion';

export default function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="space-y-2 mb-8"
    >
      <h1 className="text-5xl md:text-6xl font-serif font-light text-ink-800 tracking-tight">
        Ruminate
      </h1>
      
      <motion.div 
        className="h-px w-32 bg-terracotta-400 opacity-70 mx-auto"
        initial={{ width: 0 }}
        animate={{ width: '8rem' }}
        transition={{ duration: 1.2, delay: 0.5 }}
      />
      
      <p className="font-serif text-xl text-ink-600 italic font-light mt-4">
        The AI agent that reads between the lines
      </p>
    </motion.div>
  );
}
