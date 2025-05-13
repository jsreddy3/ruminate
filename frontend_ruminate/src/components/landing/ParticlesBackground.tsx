import { motion } from 'framer-motion';
import Image from 'next/image';

interface ParticlesBackgroundProps {
  dimensions: {
    width: number;
    height: number;
  };
}

// SVG paths for hand-drawn elements (placeholder for actual SVGs)
const svgElements = [
  { id: 'page', width: 40, height: 48 },
  { id: 'note', width: 44, height: 40 },
  { id: 'quill', width: 50, height: 50 },
  { id: 'star', width: 24, height: 24 },
  { id: 'curl', width: 30, height: 20 },
];

export default function ParticlesBackground({ dimensions }: ParticlesBackgroundProps) {
  if (dimensions.width === 0) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-paper-texture">
      {/* Main floating elements */}
      {[...Array(12)].map((_, i) => {
        const element = svgElements[i % svgElements.length];
        const scale = 0.6 + Math.random() * 0.6;
        const rotationStart = -15 + Math.random() * 30;
        const rotationEnd = rotationStart + (-10 + Math.random() * 20);
        const duration = 15 + Math.random() * 20;
        
        return (
          <motion.div
            key={i}
            className="absolute opacity-0"
            style={{
              width: element.width * scale,
              height: element.height * scale,
            }}
            initial={{
              x: Math.random() * dimensions.width,
              y: dimensions.height + 50,
              rotate: rotationStart,
            }}
            animate={{
              y: -100,
              rotate: rotationEnd,
              opacity: [0, 0.3, 0.4, 0.3, 0],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              delay: Math.random() * 40,
              ease: "linear",
            }}
          >
            {/* Placeholder for SVG/image - you'll replace these with your actual assets */}
            <div className="w-full h-full opacity-10 bg-ink-500 rounded-sm"></div>
          </motion.div>
        );
      })}
      
      {/* Subtle ink dots */}
      {[...Array(30)].map((_, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute w-1.5 h-1.5 rounded-full bg-ink-300/10"
          initial={{
            x: Math.random() * dimensions.width,
            y: Math.random() * dimensions.height,
            scale: 0.2 + Math.random() * 0.8,
          }}
          animate={{
            y: [null, '-80%'],
            opacity: [0, 0.4, 0],
          }}
          transition={{
            duration: Math.random() * 20 + 15,
            repeat: Infinity,
            delay: Math.random() * 20,
          }}
        />
      ))}
    </div>
  );
}
