"use client";

import { motion, useInView } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface WordJumbleProps {
  speedUp?: boolean;
}

export default function WordJumble({ speedUp = false }: WordJumbleProps) {
  const [spotlightX, setSpotlightX] = useState(50);
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  
  const words = [
    // Recognizable but scary
    { text: 'postmodernism', size: 'text-4xl', color: 'text-library-cream-200/80', rotation: -15 },
    { text: 'phenomenology', size: 'text-5xl', color: 'text-library-cream-300/80', rotation: 12 },
    { text: 'dialectic', size: 'text-3xl', color: 'text-library-gold-300/80', rotation: 18 },
    { text: 'deconstruction', size: 'text-3xl', color: 'text-library-sage-300/80', rotation: -8 },
    // Actually difficult stuff
    { text: 'heteronormativity', size: 'text-2xl', color: 'text-library-gold-400/80', rotation: -20 },
    { text: 'subaltern', size: 'text-4xl', color: 'text-library-sage-400/80', rotation: 30 },
    { text: 'biopower', size: 'text-3xl', color: 'text-library-cream-200/80', rotation: -25 },
    { text: 'necropolitics', size: 'text-3xl', color: 'text-library-gold-300/80', rotation: 22 },
    // Law stuff people hate
    { text: 'originalism', size: 'text-4xl', color: 'text-library-sage-300/80', rotation: -10 },
    { text: 'textualism', size: 'text-3xl', color: 'text-library-cream-400/80', rotation: 25 },
    { text: 'penumbra', size: 'text-2xl', color: 'text-library-gold-400/80', rotation: -28 },
    { text: 'cosmopolitanism', size: 'text-3xl', color: 'text-library-sage-400/80', rotation: 15 },
    // Lit theory pain
    { text: 'intertextuality', size: 'text-4xl', color: 'text-library-cream-300/80', rotation: -18 },
    { text: 'paratext', size: 'text-2xl', color: 'text-library-gold-300/80', rotation: 35 },
    { text: 'metanarrative', size: 'text-3xl', color: 'text-library-sage-300/80', rotation: -12 },
    { text: 'simulacra', size: 'text-2xl', color: 'text-library-cream-400/80', rotation: 20 },
  ];

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center px-8">
      <div className="relative w-full max-w-7xl mx-auto">
        {/* Desk surface container */}
        <div className="relative rounded-3xl overflow-hidden">
          {/* Main desk surface */}
          <div className="relative bg-gradient-to-br from-amber-950 via-amber-900 to-stone-900 shadow-2xl">
            {/* Rich wood grain texture */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(
                    90deg,
                    transparent,
                    transparent 3px,
                    rgba(92, 51, 23, 0.4) 3px,
                    rgba(92, 51, 23, 0.4) 6px
                  ),
                  repeating-linear-gradient(
                    0deg,
                    transparent,
                    transparent 2px,
                    rgba(120, 53, 15, 0.2) 2px,
                    rgba(120, 53, 15, 0.2) 4px
                  ),
                  radial-gradient(ellipse at 20% 30%, rgba(92, 51, 23, 0.1) 0%, transparent 40%),
                  radial-gradient(ellipse at 80% 70%, rgba(120, 53, 15, 0.1) 0%, transparent 40%)
                `,
              }}
            />
            
            {/* Polish/varnish effect */}
            <div className="absolute inset-0 bg-gradient-to-t from-transparent via-amber-100/5 to-amber-50/10" />
            
            {/* Edge highlight */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-amber-200/20 to-transparent" />
          
          <div className="relative py-32 px-16">
      
      <div className="relative z-10 w-full px-8">
        {/* Top text */}
        <motion.h3
          initial={{ opacity: 0, y: -20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.8, delay: 0 }}
          className="text-3xl md:text-4xl font-sans font-light text-center text-library-cream-100 mb-12"
        >
          Need to master the chapter
        </motion.h3>
      
      {/* Word jumble */}
      <motion.div 
        className="relative w-full h-96 overflow-hidden"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6, delay: 0 }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            {words.map((word, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { 
                  opacity: [0, 0.3, 0.6, 0.3],
                  scale: [0.8, 0.9, 1.1, 0.9],
                  x: Math.sin(index * 0.5) * 150,
                  y: Math.cos(index * 0.7) * 100,
                } : { opacity: 0, scale: 0.8 }}
                transition={{
                  duration: speedUp ? 5 + index * 1 : 10 + index * 2,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                  delay: speedUp ? 0.1 : 0 + index * 0.03,
                }}
                className={`absolute ${word.size} ${word.color} font-iowan italic opacity-70`}
                style={{
                  left: `${5 + (index * 23) % 85}%`,
                  top: `${10 + (index * 18) % 75}%`,
                  transform: `rotate(${word.rotation}deg)`,
                  textShadow: '0 0 20px rgba(249, 207, 95, 0.3), 0 0 40px rgba(249, 207, 95, 0.1)',
                }}
              >
                {word.text}
              </motion.div>
            ))}
            
            {/* Central blur effect */}
            <div className="absolute inset-0 bg-gradient-radial from-transparent via-surface-paper/50 to-transparent pointer-events-none" />
          </div>
        </div>
      </motion.div>
      
        {/* Bottom text */}
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-3xl md:text-4xl font-sans font-light text-center text-library-cream-100 mt-12"
        >
          but can't finish this page?
        </motion.h3>
      </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}