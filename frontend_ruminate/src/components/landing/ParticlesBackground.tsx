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
    <div className="absolute inset-0 pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full bg-library-gold-400/20"
          initial={{
            x: Math.random() * dimensions.width,
            y: Math.random() * dimensions.height,
          }}
          animate={{
            y: [null, '-100%'],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: Math.random() * 5 + 5,
            repeat: Infinity,
            delay: Math.random() * 5,
          }}
        />
      ))}
    </div>
  );
}
