'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, UserResponse } from './api';

interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nickname: string) => Promise<void>;
  registerVerify: (email: string, otp: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load token from localStorage
    const savedToken = localStorage.getItem('bamboo_token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const userData = await auth.me(authToken);
      setUser(userData);
    } catch {
      // Token invalid, clear it
      localStorage.removeItem('bamboo_token');
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await auth.login(email, password);
    localStorage.setItem('bamboo_token', response.access_token);
    setToken(response.access_token);
    await fetchUser(response.access_token);
  };

  const register = async (email: string, password: string, nickname: string) => {
    // Step 1: Send OTP to personal email (does NOT create user yet)
    await auth.register(email, password, nickname);
    // Returns { message: "인증 코드가 발송되었습니다" }
    // Caller should redirect to OTP input step
  };

  const registerVerify = async (email: string, otp: string) => {
    // Step 2: Verify OTP and create user in DB
    const response = await auth.registerVerify(email, otp);
    localStorage.setItem('bamboo_token', response.access_token);
    setToken(response.access_token);
    await fetchUser(response.access_token);
  };

  const logout = () => {
    localStorage.removeItem('bamboo_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) {
      await fetchUser(token);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, registerVerify, logout, refreshUser }}>
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
