import { motion } from 'framer-motion';

interface ParticlesBackgroundProps {
  dimensions: {
    width: number;
    height: number;
  };
}

export default function ParticlesBackground({ dimensions }: ParticlesBackgroundProps) {
  if (dimensions.width === 0) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-paper-texture">
      {/* Subtle ink dots */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute w-1 h-1 rounded-full bg-ink-300/10"
          initial={{
            x: Math.random() * dimensions.width,
            y: Math.random() * dimensions.height,
            scale: 0.2 + Math.random() * 0.8,
          }}
          animate={{
            y: [null, '-60%'],
            opacity: [0, 0.3, 0],
          }}
          transition={{
            duration: Math.random() * 20 + 20,
            repeat: Infinity,
            delay: Math.random() * 15,
          }}
        />
      ))}
    </div>
  );
}
