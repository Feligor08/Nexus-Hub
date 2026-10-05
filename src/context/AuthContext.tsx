import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/platform';
import { api } from '../services/api';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { emailOrUsername?: string; email?: string; password: string }) => Promise<void>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profileData: Partial<User>) => Promise<User>;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
  isCreator: boolean;
  isModerator: boolean;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register';
  openAuthModal: (mode?: 'login' | 'register') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const loadUser = async () => {
    try {
      const res = await api.getMe();
      if (res.authenticated && res.user) {
        setCurrentUser(res.user);
        setIsAuthenticated(true);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    } catch (e) {
      console.warn('Session restore check completed with guest state:', e);
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (credentials: { emailOrUsername?: string; email?: string; password: string }) => {
    const res = await api.login(credentials);
    setCurrentUser(res.user);
    setIsAuthenticated(true);
    closeAuthModal();
  };

  const register = async (data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }) => {
    const res = await api.register(data);
    setCurrentUser(res.user);
    setIsAuthenticated(true);
    closeAuthModal();
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.warn('Logout API error:', e);
    } finally {
      setCurrentUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateProfile = async (profileData: Partial<User>): Promise<User> => {
    const updated = await api.updateProfile(profileData);
    setCurrentUser(updated);
    return updated;
  };

  const userRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  const isAdmin = currentUser?.role === 'ADMIN' || userRoles.includes('ADMIN');
  const isCreator = isAdmin || currentUser?.role === 'CREATOR' || userRoles.includes('CREATOR');
  const isModerator = isAdmin || currentUser?.role === 'MODERATOR' || userRoles.includes('MODERATOR');

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
        refreshUser: loadUser,
        isAdmin,
        isCreator,
        isModerator,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
