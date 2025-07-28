"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  token: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
            } else {
              // Token is invalid, clear it
              localStorage.removeItem('auth_token');
              setToken(null);
            }
          } else {
            // Token is invalid, clear it
            localStorage.removeItem('auth_token');
            setToken(null);
          }
        } catch (error) {
          console.error('Error verifying token:', error);
          localStorage.removeItem('auth_token');
          setToken(null);
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Handle auth callback from backend
  useEffect(() => {
    console.log('AuthContext: Checking URL for auth callback');
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const userParam = urlParams.get('user');
    const errorParam = urlParams.get('error');

    console.log('AuthContext: URL params', { 
      url: window.location.href,
      hasToken: !!tokenParam, 
      hasUser: !!userParam, 
      hasError: !!errorParam 
    });

    if (errorParam) {
      console.error('Auth error:', decodeURIComponent(errorParam));
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (tokenParam && userParam) {
      console.log('AuthContext: Processing auth callback with token');
      try {
        const userData = JSON.parse(decodeURIComponent(userParam));
        console.log('AuthContext: Parsed user data:', userData);
        setToken(tokenParam);
        setUser(userData);
        localStorage.setItem('auth_token', tokenParam);
        console.log('AuthContext: Token saved to localStorage');
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('AuthContext: URL cleaned up');
      } catch (error) {
        console.error('Error parsing auth callback:', error);
      }
    } else {
      console.log('AuthContext: No auth params in URL');
    }
  }, []);

  const login = () => {
    // Redirect to backend Google OAuth
    window.location.href = `${API_BASE_URL}/auth/login`;
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
      localStorage.removeItem('auth_token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, token }}>
      {children}
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