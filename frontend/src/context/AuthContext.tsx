import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Event } from '../types';
import { api, getToken, removeToken, setToken } from '../api';

interface AuthContextType {
  user: User | null;
  activeEvent: Event | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setActiveEvent: (event: Event | null) => void;
  refreshUser: () => Promise<void>;
  refreshActiveEvent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = getToken();
      if (!token) {
        setUser(null);
        return;
      }
      const me = await api.getMe();
      setUser(me);
    } catch (err) {
      removeToken();
      setUser(null);
    }
  };

  const refreshActiveEvent = async () => {
    try {
      const event = await api.getActiveEvent();
      setActiveEvent(event);
    } catch (err) {
      console.warn('No hay evento activo disponible');
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      await refreshUser();
      await refreshActiveEvent();
      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      removeToken();
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    setToken(res.token);
    setUser(res.user);
    await refreshActiveEvent();
  };

  const logout = () => {
    removeToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeEvent,
        loading,
        login,
        logout,
        setActiveEvent,
        refreshUser,
        refreshActiveEvent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
