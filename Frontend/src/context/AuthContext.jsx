import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("ca_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    // Default demo user as Analyst
    return {
      role: "analyst",
      name: "Corporate Analyst",
      initials: "AN",
      title: "Portfolio Analyst",
      email: "analyst@corporateactions.com",
    };
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem("ca_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("ca_user");
    }
  }, [user]);

  const login = (username, password) => {
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser === "admin" && password === "admin") {
      const adminUser = {
        role: "admin",
        name: "Admin User",
        initials: "AU",
        title: "System Administrator",
        email: "admin@corporateactions.com",
      };
      setUser(adminUser);
      return { success: true, role: "admin" };
    }
    if (cleanUser === "analyst" && password === "analyst") {
      const analystUser = {
        role: "analyst",
        name: "Corporate Analyst",
        initials: "AN",
        title: "Portfolio Analyst",
        email: "analyst@corporateactions.com",
      };
      setUser(analystUser);
      return { success: true, role: "analyst" };
    }
    return { success: false, error: "Invalid username or password" };
  };

  const switchRole = (newRole) => {
    if (newRole === "admin") {
      setUser({
        role: "admin",
        name: "Admin User",
        initials: "AU",
        title: "System Administrator",
        email: "admin@corporateactions.com",
      });
    } else {
      setUser({
        role: "analyst",
        name: "Corporate Analyst",
        initials: "AN",
        title: "Portfolio Analyst",
        email: "analyst@corporateactions.com",
      });
    }
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
