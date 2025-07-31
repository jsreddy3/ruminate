import { motion } from 'framer-motion';
import AuthButton from '@/components/auth/AuthButton';

export default function Header() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="space-y-12 text-center"
    >
      <div className="space-y-6">
        <h1 className="text-6xl md:text-7xl font-serif font-bold text-reading-primary tracking-tight">
          Ruminate
        </h1>
        <p className="text-2xl md:text-3xl font-serif font-medium text-reading-secondary">
          The AI agent that reads between the lines
        </p>
        <p className="text-lg md:text-xl font-serif text-reading-muted mt-8 max-w-2xl mx-auto leading-relaxed">
          Transform your PDFs with AI-powered analysis
        </p>
      </div>
      
      {/* Auth Button centered with main content */}
      <div className="flex justify-center mt-12">
        <AuthButton />
      </div>
    </motion.div>
  );
}
