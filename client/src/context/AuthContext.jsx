import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext();
const TOKEN_KEY = 'testcraft_token';
const USER_KEY = 'testcraft_user';

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
};

const persistSession = (nextToken, nextUser) => {
  if (nextToken) localStorage.setItem(TOKEN_KEY, nextToken);
  if (nextUser) localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const initializeAuth = async () => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.success && res.user) {
        setUser(res.user);
        persistSession(storedToken, res.user);
      } else {
        logout();
      }
    } catch (err) {
      // A cold Render instance or a dropped connection must not sign the user
      // out. Only an explicit auth rejection clears the session.
      if (err.status === 401 || err.status === 403) {
        logout();
      } else {
        console.warn('Could not refresh the session right now; keeping cached profile:', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.login({ email, password });
    if (res.success && res.token) {
      persistSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed.');
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    if (res.success && res.token) {
      persistSession(res.token, res.user);
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Registration failed.');
  };

  const updateProfile = async (profileData) => {
    const res = await api.updateProfile(profileData);
    if (res.success && res.user) {
      persistSession(null, res.user);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Update failed.');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        register,
        logout,
        updateProfile,
        refreshUser: initializeAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
