import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { path: "/", icon: "📁", label: "My Files" },
  { path: "/shared", icon: "🤝", label: "Shared With Me" },
  { path: "/upload", icon: "⬆️", label: "Upload" },
  { path: "/manage-shares", icon: "🔗", label: "Manage Shares" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="sidebar">
      <div className="logo">
        <span className="logo-text">AnyShare</span>
      </div>

      <div className="nav-section">Navigation</div>
      {navItems.map((item) => (
        <button key={item.path} className={`nav-item ${pathname === item.path ? "active" : ""}`}
          onClick={() => navigate(item.path)}>
          <span className="icon">{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || "?"}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
        </div>
        <button className="nav-item" onClick={logout} style={{ color: "var(--red)", marginTop: 4 }}>
          <span className="icon">🚪</span>Sign out
        </button>
      </div>
    </div>
  );
}
