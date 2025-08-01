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
  const [canTransition, setCanTransition] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTime = useRef<number>(0);
  const isScrolling = useRef<boolean>(false);

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
    if (!canTransition) return;
    
    const container = containerRef.current;
    if (container) {
      const targetPosition = index * window.innerHeight;
      const startPosition = container.scrollTop;
      const distance = targetPosition - startPosition;
      const duration = 1500; // 1.5 seconds for slow scroll
      let start: number | null = null;
      
      const animation = (currentTime: number) => {
        if (start === null) start = currentTime;
        const timeElapsed = currentTime - start;
        const progress = Math.min(timeElapsed / duration, 1);
        
        // Easing function for smooth scroll
        const easeInOutCubic = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        
        container.scrollTop = startPosition + (distance * easeInOutCubic);
        
        if (progress < 1) {
          requestAnimationFrame(animation);
        }
      };
      
      requestAnimationFrame(animation);
    }
  };

  // Track which section is in view and manage transition timer
  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;
      
      const scrollPosition = container.scrollTop;
      const sectionHeight = window.innerHeight;
      const newSection = Math.round(scrollPosition / sectionHeight);
      
      if (newSection !== currentSection) {
        // Immediately lock if trying to change sections when not allowed
        if (!canTransition) {
          container.scrollTop = currentSection * sectionHeight;
          return;
        }
        
        setCurrentSection(newSection);
        setCanTransition(false);
        
        // Clear existing timer
        if (sectionTimerRef.current) {
          clearTimeout(sectionTimerRef.current);
        }
        
        // Start timer based on section - longer delay for word jumble
        const delay = newSection === 1 ? 2500 : 1500;
        sectionTimerRef.current = setTimeout(() => {
          setCanTransition(true);
        }, delay);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => {
        container.removeEventListener('scroll', handleScroll);
        if (sectionTimerRef.current) {
          clearTimeout(sectionTimerRef.current);
        }
      };
    }
  }, [currentSection, canTransition]);

  // Initial timer on mount
  useEffect(() => {
    sectionTimerRef.current = setTimeout(() => {
      setCanTransition(true);
    }, 2000); // 2 seconds for first page
    
    return () => {
      if (sectionTimerRef.current) {
        clearTimeout(sectionTimerRef.current);
      }
    };
  }, []);

  // Prevent keyboard navigation when locked
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!canTransition && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canTransition]);

  // Prevent touch scrolling when locked
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!canTransition) {
        e.preventDefault();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      return () => container.removeEventListener('touchmove', handleTouchMove);
    }
  }, [canTransition]);

  // Prevent scroll during transition lock
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!canTransition || isScrolling.current) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [canTransition]);

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
        <AnimatePresence>
          {canTransition && currentSection === 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
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
        </AnimatePresence>
      </section>

      {/* Word jumble section - full screen */}
      <section className="relative h-screen snap-start flex items-center justify-center">
        <WordJumble />
        
        {/* Navigation arrows */}
        <AnimatePresence>
          {canTransition && currentSection === 1 && (
            <>
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
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
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
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
        </AnimatePresence>
      </section>

      {/* App previews section - full screen */}
      <section className="relative h-screen snap-start flex items-center justify-center">
        <AppPreviews />
        
        {/* Up arrow only */}
        <AnimatePresence>
          {canTransition && currentSection === 2 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
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
        </AnimatePresence>
      </section>
    </div>
  );
}