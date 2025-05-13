import { motion } from 'framer-motion';
import TexturedHeading from './TexturedHeading';

export default function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="space-y-6"
    >
      <TexturedHeading>
        Ruminate
      </TexturedHeading>
      
      <p className="font-serif text-2xl md:text-3xl text-ink-700 italic font-light">
        The AI agent that reads between the lines
      </p>
    </motion.div>
  );
}
