"use client";

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthButton() {
  const { user, isLoading, login, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-4 py-2 bg-surface-paper bg-opacity-90 backdrop-blur-sm rounded-book border border-library-cream-300">
        <div className="w-4 h-4 border-2 border-library-sage-400 border-t-library-mahogany-500 rounded-full animate-spin"></div>
        <span className="text-reading-primary text-sm font-serif">Loading...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 px-3 py-2 bg-surface-paper bg-opacity-90 backdrop-blur-sm rounded-book border border-library-cream-300">
          {user.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.name}
              className="w-6 h-6 rounded-full"
            />
          )}
          <span className="text-reading-primary text-sm font-serif font-medium">{user.name}</span>
        </div>
        <button
          onClick={logout}
          className="px-3 py-2 text-sm text-white bg-library-mahogany-500 hover:bg-library-mahogany-600 rounded-book transition-all duration-200 shadow-paper"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="group relative px-10 py-4 bg-library-mahogany-500 hover:bg-library-mahogany-600 text-surface-paper font-iowan font-medium text-xl rounded-lg shadow-deep hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
      
      {/* Button content */}
      <span className="relative flex items-center gap-3">
        Get Started
        <svg className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </span>
    </button>
  );
}