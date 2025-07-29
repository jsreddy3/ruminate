"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from './Header';
import ParticlesBackground from './ParticlesBackground';

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
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-neutral-50 to-indigo-100 p-8 overflow-hidden">
      <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-12 w-full">
        {/* Logo and Tagline */}
        <Header />

        {/* Welcome message for non-authenticated users */}
        {!user && !isLoading && (
          <div className="max-w-md mx-auto p-6 bg-white bg-opacity-10 backdrop-blur-sm rounded-lg border border-white border-opacity-20">
            <p className="text-lg text-neutral-700 mb-2">Welcome to Ruminate!</p>
            <p className="text-neutral-600">Sign in with Google to start analyzing your documents with AI.</p>
          </div>
        )}
      </div>

      {/* Floating particles effect */}
      <ParticlesBackground dimensions={dimensions} />
    </div>
  );
}