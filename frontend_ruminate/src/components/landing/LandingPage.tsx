"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Header from './Header';
import ParticlesBackground from './ParticlesBackground';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

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

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-surface-paper to-surface-parchment px-8 py-16 overflow-hidden">
      <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-12 w-full">
        {/* Logo and Tagline */}
        <Header />
      </div>

      {/* Floating particles effect */}
      <ParticlesBackground dimensions={dimensions} />
    </div>
  );
}