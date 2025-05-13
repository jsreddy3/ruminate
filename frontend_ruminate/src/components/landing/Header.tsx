import { motion } from 'framer-motion';
import Image from 'next/image';

export default function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="space-y-7"
    >
      <h1 className="text-5xl md:text-6xl font-serif font-light text-ink-800 tracking-tight relative">
        <span className="relative">
          Ruminate
          <motion.div 
            className="absolute -bottom-3 left-0 w-full h-0.5 bg-terracotta-400 opacity-70"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.2, delay: 0.5 }}
          />
        </span>
      </h1>
      
      <p className="font-serif text-xl md:text-2xl text-ink-600 italic font-light tracking-wide leading-relaxed">
        The AI agent that reads between the lines
      </p>
      
      <p className="text-lg text-ink-500 font-light mt-4 max-w-xl mx-auto">
        Upload your document!
      </p>
    </motion.div>
  );
}
