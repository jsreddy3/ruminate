"use client";

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from './Header';
import ParticlesBackground from './ParticlesBackground';
import AppPreviews from './AppPreviews';
import WordJumble from './WordJumble';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [currentSection, setCurrentSection] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update dimensions on mount and window resize
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Redirect to home if already authenticated
  useEffect(() => {
    if (!isLoading && user) {
      router.push('/home');
    }
  }, [user, isLoading, router]);

  const scrollToSection = (index: number) => {
    const container = containerRef.current;
    if (container) {
      container.children[index].scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Track which section is in view
  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const scrollPosition = container.scrollTop;
      const sectionHeight = window.innerHeight;
      const newSection = Math.round(scrollPosition / sectionHeight);
      setCurrentSection(newSection);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative h-screen overflow-y-auto snap-y snap-mandatory"
      style={{ 
        scrollBehavior: 'smooth',
        scrollSnapType: 'y mandatory',
        overscrollBehavior: 'none'
      }}
    >
      {/* Hero section - full screen */}
      <section className="relative flex flex-col items-center justify-center h-screen snap-start px-8 py-8 bg-gradient-to-br from-surface-paper to-surface-parchment overflow-hidden">
        <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-12 w-full">
          {/* Logo and Tagline */}
          <Header />
        </div>

        {/* Floating particles effect */}
        <ParticlesBackground dimensions={dimensions} />

        {/* Down arrow */}
        {currentSection === 0 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 3 }}
            onClick={() => scrollToSection(1)}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-reading-muted hover:text-reading-primary transition-colors"
          >
            <motion.div
              animate={{ 
                y: [0, 10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <ChevronDown size={48} />
            </motion.div>
          </motion.button>
        )}
      </section>

      {/* Word jumble section - full screen */}
      <section className="relative h-screen snap-start flex items-center justify-center">
        <WordJumble />
        
        {/* Navigation arrows */}
        {currentSection === 1 && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.8 }}
              onClick={() => scrollToSection(0)}
              className="absolute top-8 left-1/2 -translate-x-1/2 text-reading-muted hover:text-reading-primary transition-colors z-20"
            >
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <ChevronUp size={48} />
              </motion.div>
            </motion.button>
            
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.8 }}
              onClick={() => scrollToSection(2)}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-reading-muted hover:text-reading-primary transition-colors z-20"
            >
              <motion.div
                animate={{ 
                  y: [0, 10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <ChevronDown size={48} />
              </motion.div>
            </motion.button>
          </>
        )}
      </section>

      {/* App previews section - full screen */}
      <section className="relative h-screen snap-start flex items-center justify-center">
        <AppPreviews />
        
        {/* Up arrow only */}
        {currentSection === 2 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            onClick={() => scrollToSection(1)}
            className="absolute top-8 left-1/2 -translate-x-1/2 text-reading-muted hover:text-reading-primary transition-colors z-20"
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <ChevronUp size={48} />
            </motion.div>
          </motion.button>
        )}
      </section>
    </div>
  );
}