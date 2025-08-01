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
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl z-10"
          >
            <div className="relative transform rotate-1 hover:rotate-0 transition-transform duration-500">
              {/* Shadow layers */}
              <div className="absolute inset-0 bg-library-mahogany-900/10 rounded-3xl blur-2xl transform translate-y-8" />
              
              {/* Main card */}
              <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-library-cream-300">
                <div className="aspect-[16/10] bg-gradient-to-br from-library-cream-100 to-library-cream-200 flex items-center justify-center p-8">
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-8 shadow-inner">
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
            className="absolute left-0 top-10 w-64 transform hover:-rotate-3 transition-transform duration-500"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-library-forest-900/10 rounded-2xl blur-xl transform translate-y-4" />
              <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-library-cream-300">
                <div className="aspect-[3/4] bg-gradient-to-br from-library-sage-100 to-library-sage-200 p-4">
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-4 shadow-inner">
                    <p className="text-reading-primary font-iowan text-lg mb-3">Your Library</p>
                    <div className="space-y-2">
                      <div className="h-2 bg-library-sage-300/50 rounded w-full"></div>
                      <div className="h-2 bg-library-sage-300/50 rounded w-4/5"></div>
                      <div className="h-2 bg-library-sage-300/50 rounded w-3/4"></div>
                    </div>
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
            className="absolute right-0 top-20 w-56 transform hover:rotate-3 transition-transform duration-500"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-library-gold-900/10 rounded-2xl blur-xl transform translate-y-4" />
              <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-library-cream-300">
                <div className="aspect-[4/5] bg-gradient-to-br from-library-gold-100 to-library-gold-200 p-4">
                  <div className="bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow-inner">
                    <p className="text-reading-primary font-iowan text-base mb-3">AI Assistant</p>
                    <div className="space-y-2">
                      <div className="bg-library-gold-300/30 rounded-lg p-2 ml-auto w-3/4">
                        <div className="h-1.5 bg-library-gold-400/50 rounded"></div>
                      </div>
                      <div className="bg-library-mahogany-300/30 rounded-lg p-2 mr-auto w-3/4">
                        <div className="h-1.5 bg-library-mahogany-400/50 rounded"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
          
          {/* Get Started Button */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.6, delay: 3.0 }}
            >
              <div className="transform scale-[1.5]">
                <AuthButton />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}