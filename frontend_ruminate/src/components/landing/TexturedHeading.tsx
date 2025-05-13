import React from 'react';

interface TexturedHeadingProps {
  children: React.ReactNode;
  className?: string;
}

export default function TexturedHeading({ children, className = '' }: TexturedHeadingProps) {
  return (
    <h1 
      className={`font-noto-serif text-7xl md:text-8xl font-bold tracking-tight textured-heading text-center inline-block ${className}`}
      style={{
        backgroundImage: 'url("/brown_noise.jpg")',
        backgroundRepeat: 'repeat',
        backgroundSize: '300px',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: '#544a3d', /* Fallback color */
        WebkitTextFillColor: 'transparent',
        textShadow: `
          0 0 1px rgba(77, 58, 42, 0.4),
          0 0 2px rgba(77, 58, 42, 0.3),
          0 0 3px rgba(77, 58, 42, 0.2),
          0 0 4px rgba(77, 58, 42, 0.1),
          0 1px 3px rgba(77, 58, 42, 0.3)
        `
      }}
    >
      {children}
    </h1>
  );
} 