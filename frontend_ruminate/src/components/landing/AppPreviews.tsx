"use client";

import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import AuthButton from '@/components/auth/AuthButton';

export default function AppPreviews() {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });

  return (
    <div ref={containerRef} className="relative w-full px-8 py-16">
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl border border-library-cream-200 px-16 pt-24 pb-16 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-library-gold-100/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-library-mahogany-100/20 rounded-full blur-3xl" />
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 text-4xl md:text-5xl font-sans font-light text-center text-reading-primary mb-20 tracking-wide"
            style={{ marginTop: '4rem' }}
          >
            Try a better way to read.
          </motion.h2>
          
          <div className="relative h-[600px] z-10">
          {/* Main preview - PDF Reader */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.9 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl z-10"
          >
            <div className="relative transform rotate-1 hover:rotate-0 transition-transform duration-500">
              {/* Shadow layers */}
              <div className="absolute inset-0 bg-library-mahogany-900/10 rounded-3xl blur-2xl transform translate-y-8" />
              
              {/* Main card */}
              <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-library-cream-300">
                <div className="aspect-[16/10] relative flex items-center justify-center">
                  <img 
                    src="/PDFView.png" 
                    alt="PDF Reader interface showing document viewer" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Overlay label - centered on visible container */}
                  <div className="relative z-10 bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-inner">
                    <p className="text-reading-primary font-iowan text-2xl mb-2">PDF Reader</p>
                    <p className="text-reading-muted text-sm">Your documents, beautifully rendered</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Library view - floating left */}
          <motion.div
            initial={{ opacity: 0, x: -40, rotate: -10 }}
            animate={isInView ? { opacity: 1, x: 0, rotate: -6 } : { opacity: 0, x: -40, rotate: -10 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="absolute left-0 top-10 w-80 transform hover:-rotate-3 transition-transform duration-500"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-library-forest-900/10 rounded-2xl blur-xl transform translate-y-4" />
              <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-library-cream-300">
                <div className="aspect-[3/4] relative flex items-center justify-center">
                  <img 
                    src="/Library.png" 
                    alt="Library interface showing document collection" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="relative z-10 bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-inner">
                    <p className="text-reading-primary font-iowan text-lg mb-2">Your Library</p>
                    <p className="text-reading-muted text-sm">All your documents, organized</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chat interface - floating right */}
          <motion.div
            initial={{ opacity: 0, x: 40, rotate: 10 }}
            animate={isInView ? { opacity: 1, x: 0, rotate: 6 } : { opacity: 0, x: 40, rotate: 10 }}
            transition={{ duration: 0.8, delay: 1.0 }}
            className="absolute right-0 -top-10 w-80 transform hover:rotate-3 transition-transform duration-500"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-library-gold-900/10 rounded-2xl blur-xl transform translate-y-4" />
              <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-library-cream-300">
                <div className="aspect-[4/5] relative flex items-center justify-center">
                  <img 
                    src="/Assistant.png" 
                    alt="AI Assistant chat interface" 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="relative z-10 bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-inner">
                    <p className="text-reading-primary font-iowan text-base mb-2">AI Assistant</p>
                    <p className="text-reading-muted text-sm">Smart insights, instant answers</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
          
          {/* Get Started Button */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { 
                opacity: 1, 
                y: 0,
                transition: {
                  duration: 0.8,
                  delay: 1.5,
                  ease: [0.21, 0.47, 0.32, 0.98]
                }
              } : { opacity: 0, y: 20 }}
            >
              <motion.div
                initial={{ scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
                className="relative"
              >
                {/* Glow effect */}
                <motion.div
                  className="absolute inset-0 bg-library-mahogany-400/20 blur-2xl rounded-full"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <div className="transform scale-[1.5] relative">
                  <AuthButton />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}