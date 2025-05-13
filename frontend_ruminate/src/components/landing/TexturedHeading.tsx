import React from 'react';

interface TexturedHeadingProps {
  children: React.ReactNode;
  className?: string;
}

export default function TexturedHeading({ children, className = '' }: TexturedHeadingProps) {
  return (
    <h1 
      className={`font-noto-serif text-6xl md:text-7xl font-medium tracking-tight textured-heading ${className}`}
      style={{
        backgroundImage: 'url("/brown_noise.jpg")',
        backgroundRepeat: 'repeat',
        backgroundSize: '300px',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        textShadow: '0 0.5px 0.5px rgba(0,0,0,0.1)'
      }}
    >
      {children}
    </h1>
  );
} 