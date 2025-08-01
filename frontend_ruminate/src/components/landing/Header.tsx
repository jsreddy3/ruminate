import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function Header() {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  
  const words = [
    { text: 'students', className: 'font-iowan' },
    { text: 'lawyers', className: 'font-iowan' },
    { text: 'professors', className: 'font-iowan' },
    { text: 'writers', className: 'font-iowan' },
    { text: 'readers', className: 'font-iowan italic' }, // Special font for 'readers'
  ];

  useEffect(() => {
    if (hasReachedEnd) return; // Stop cycling once we reach 'readers'
    
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => {
        const nextIndex = prev + 1;
        if (nextIndex >= words.length - 1) {
          setHasReachedEnd(true);
          return words.length - 1; // Stay on 'readers'
        }
        return nextIndex;
      });
    }, 2000); // Change word every 2 seconds

    return () => clearInterval(interval);
  }, [hasReachedEnd]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="space-y-16 text-center"
    >
      <div>
        <h1 className="text-7xl md:text-8xl font-serif font-bold text-reading-primary tracking-tight mb-16">
          Ruminate
        </h1>
        <div className="text-5xl md:text-6xl lg:text-7xl font-medium text-reading-secondary text-center">
          <div className="inline-block relative">
            <span className="font-iowan">Built for </span>
            <span className="inline-block relative">
              {/* Invisible "readers" to maintain spacing */}
              <span className="font-iowan italic invisible">readers</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentWordIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute left-0 top-0 ${words[currentWordIndex].className} ${
                    currentWordIndex === words.length - 1 ? 'text-library-gold-600' : ''
                  }`}
                >
                  {words[currentWordIndex].text}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
