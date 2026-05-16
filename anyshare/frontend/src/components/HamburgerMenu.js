import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { path: "/", icon: "📁", label: "My Files" },
  { path: "/shared", icon: "🤝", label: "Shared With Me" },
  { path: "/upload", icon: "⬆️", label: "Upload" },
  { path: "/manage-shares", icon: "🔗", label: "Manage Shares" },
];

export default function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Close on route change
  useEffect(() => setOpen(false), [pathname]);
  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!e.target.closest(".hamburger-menu") && !e.target.closest(".hamburger-btn")) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <>
      {/* Top bar */}
      <div className="mobile-topbar">
        <div className="logo" style={{ margin: 0 }}>
          <div className="logo-icon">🔐</div>
          <span className="logo-text">AnyShare</span>
        </div>
        <button className="hamburger-btn" onClick={() => setOpen(!open)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>

      {/* Overlay */}
      {open && <div className="hamburger-overlay" onClick={() => setOpen(false)} />}

      {/* Drawer */}
      <div className={`hamburger-menu ${open ? "open" : ""}`}>
        <div style={{ padding: "24px 16px 16px" }}>
          {navItems.map((item) => (
            <button key={item.path} className={`nav-item ${pathname === item.path ? "active" : ""}`}
              onClick={() => go(item.path)}>
              <span className="icon">{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{ borderTop: "1px solid var(--border)", marginTop: 16, paddingTop: 16 }}>
            <div className="user-chip">
              <div className="user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
              <div className="user-info">
                <div className="user-name">{user?.name}</div>
                <div className="user-email">{user?.email}</div>
              </div>
            </div>
            <button className="nav-item" onClick={() => { logout(); setOpen(false); }}
              style={{ color: "var(--red)", marginTop: 4 }}>
              <span className="icon">🚪</span>Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
