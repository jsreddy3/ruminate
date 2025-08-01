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
  const [viewedSections, setViewedSections] = useState<Set<number>>(new Set([0]));
  const [sectionLocked, setSectionLocked] = useState(true);
  const [scrollAttempted, setScrollAttempted] = useState(false);
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

  // Lock section for 2 seconds on first view
  useEffect(() => {
    setSectionLocked(true);
    setScrollAttempted(false); // Reset scroll attempt state
    const timer = setTimeout(() => {
      setSectionLocked(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentSection]);

  const scrollToSection = (index: number) => {
    const container = containerRef.current;
    if (container && !sectionLocked && index >= 0 && index <= 2) {
      // Mark section as viewed
      setViewedSections(prev => new Set([...prev, index]));
      setCurrentSection(index);
      
      // Custom smooth scroll with controlled speed
      const targetElement = container.children[index] as HTMLElement;
      const targetPosition = targetElement.offsetTop;
      const startPosition = container.scrollTop;
      const distance = targetPosition - startPosition;
      const duration = 1200; // 1.2 seconds for smooth scroll
      let start: number | null = null;
      
      const animateScroll = (timestamp: number) => {
        if (!start) start = timestamp;
        const progress = timestamp - start;
        const percentage = Math.min(progress / duration, 1);
        
        // Easing function for smooth deceleration
        const easeInOutCubic = (t: number) => {
          return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
        };
        
        container.scrollTop = startPosition + (distance * easeInOutCubic(percentage));
        
        if (percentage < 1) {
          requestAnimationFrame(animateScroll);
        }
      };
      
      requestAnimationFrame(animateScroll);
    }
  };

  // Prevent all native scrolling - we handle everything manually
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!sectionLocked) {
        if (e.deltaY > 0 && currentSection < 2) {
          scrollToSection(currentSection + 1);
        } else if (e.deltaY < 0 && currentSection > 0) {
          scrollToSection(currentSection - 1);
        }
      } else if (currentSection === 1) {
        // User tried to scroll on section 2 while locked
        setScrollAttempted(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sectionLocked) {
        if ((e.key === 'ArrowDown' || e.key === 'PageDown') && currentSection < 2) {
          e.preventDefault();
          scrollToSection(currentSection + 1);
        } else if ((e.key === 'ArrowUp' || e.key === 'PageUp') && currentSection > 0) {
          e.preventDefault();
          scrollToSection(currentSection - 1);
        }
      } else if (currentSection === 1 && (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowUp' || e.key === 'PageUp')) {
        e.preventDefault();
        setScrollAttempted(true);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        container.removeEventListener('wheel', handleWheel);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [currentSection, sectionLocked]);

  return (
    <div 
      ref={containerRef}
      className="relative h-screen overflow-y-auto"
      style={{ 
        overflow: 'hidden',
        position: 'relative'
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
        {currentSection === 0 && !sectionLocked && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
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
      <section className="relative h-screen flex items-center justify-center">
        <WordJumble speedUp={scrollAttempted && currentSection === 1} />
        
        {/* Navigation arrows */}
        {currentSection === 1 && !sectionLocked && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
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
      </section>

      {/* App previews section - full screen */}
      <section className="relative h-screen flex items-center justify-center">
        <AppPreviews />
        
        {/* Up arrow only */}
        {currentSection === 2 && !sectionLocked && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
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
      </section>
    </div>
  );
}