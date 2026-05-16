import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { login as apiLogin, register as apiRegister } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("fv_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const persist = useCallback((token, userData) => {
    localStorage.setItem("fv_token", token);
    localStorage.setItem("fv_user", JSON.stringify(userData));
    setUser(userData);
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    try {
      const res = await apiLogin({ email, password });
      persist(res.data.token, res.data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Login failed" };
    } finally {
      setLoading(false);
    }
  }, [persist]);

  const register = useCallback(async (name, email, password) => {
    setLoading(true);
    try {
      const res = await apiRegister({ name, email, password });
      persist(res.data.token, res.data.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.response?.data?.error || "Registration failed" };
    } finally {
      setLoading(false);
    }
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem("fv_token");
    localStorage.removeItem("fv_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
