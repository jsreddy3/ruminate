"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authEvents } from '@/utils/api';

interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  has_completed_onboarding: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  token: string | null;
  refreshUser: () => Promise<void>;
  handleUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnauthorizedMessage, setShowUnauthorizedMessage] = useState(false);

  // Helper function to set auth token in both localStorage and cookies
  const setAuthToken = (tokenValue: string | null) => {
    if (tokenValue) {
      localStorage.setItem('auth_token', tokenValue);
      // Set cookie with 30-day expiration
      document.cookie = `auth_token=${tokenValue}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
    } else {
      localStorage.removeItem('auth_token');
      // Clear cookie
      document.cookie = 'auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('auth_token');
      if (storedToken) {
        setToken(storedToken);
        try {
          // Verify token and get user info using the status endpoint
          const response = await fetch(`${API_BASE_URL}/auth/status`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });

          if (response.ok) {
            const statusData = await response.json();
            if (statusData.authenticated && statusData.user) {
              setUser(statusData.user);
              // Ensure cookie is set
              setAuthToken(storedToken);
            } else {
              // Token is invalid, clear it
              setAuthToken(null);
              setToken(null);
            }
          } else {
            // Token is invalid, clear it
            setAuthToken(null);
            setToken(null);
          }
        } catch (error) {
          console.error('Error verifying token:', error);
          setAuthToken(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Handle auth callback from backend
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    const errorParam = urlParams.get('error');

    if (errorParam) {
      console.error('Auth error:', decodeURIComponent(errorParam));
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (tokenParam && userParam) {
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        setToken(tokenParam);
        setUser(userData);
        setAuthToken(tokenParam);
        
        // Clean up URL and trigger redirect to home
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Force redirect to home after successful auth
        if (window.location.pathname === '/') {
          window.location.href = '/home';
        }
      } catch (error) {
        console.error('Error parsing auth callback:', error);
      }
    }
  }, []);

  const login = () => {
    // Redirect to backend Google OAuth with current origin as redirect URL
    const redirectUrl = window.location.origin;
    window.location.href = `${API_BASE_URL}/auth/login?redirect_url=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      setUser(null);
      setToken(null);
      setAuthToken(null);
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const statusData = await response.json();
        if (statusData.authenticated && statusData.user) {
          setUser(statusData.user);
        }
      }
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const handleUnauthorized = useCallback(() => {
    // Clear auth state
    setUser(null);
    setToken(null);
    setAuthToken(null);
    setShowUnauthorizedMessage(true);
    
    // Hide message after 5 seconds
    setTimeout(() => {
      setShowUnauthorizedMessage(false);
    }, 5000);
    
    // Redirect to home page after a short delay
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  }, []);

  // Listen for 401 events from authenticatedFetch
  useEffect(() => {
    const handleUnauthorizedEvent = () => {
      handleUnauthorized();
    };

    authEvents.addEventListener('unauthorized', handleUnauthorizedEvent);

    return () => {
      authEvents.removeEventListener('unauthorized', handleUnauthorizedEvent);
    };
  }, [handleUnauthorized]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, token, refreshUser, handleUnauthorized }}>
      {children}
      {showUnauthorizedMessage && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in">
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">You've been signed out. Please sign in again.</p>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}