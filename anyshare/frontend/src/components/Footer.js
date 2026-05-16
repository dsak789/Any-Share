import React from "react";
import { useNavigate } from "react-router-dom";

export default function Footer({ minimal = false }) {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  if (minimal) {
    return (
      <footer className="footer-minimal">
        <span>
          © {year} <strong>dsak789</strong> · AnyShare
        </span>
        <span className="footer-dot">·</span>
        <button className="footer-link" onClick={() => navigate("/about")}>
          About
        </button>
      </footer>
    );
  }

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
            }}
          >
            <div
              className="logo-icon"
              style={{ width: 28, height: 28, fontSize: 14 }}
            >
              🔐
            </div>
            <span
              style={{
                fontWeight: 800,
                fontSize: 16,
                background: "linear-gradient(135deg,#fff,var(--accent2))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AnyShare
            </span>
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--text3)",
              lineHeight: 1.6,
              maxWidth: 200,
            }}
          >
            Secure file sharing — for your team and the world.
          </p>
        </div>

        <div className="footer-links">
          <button className="footer-link" onClick={() => navigate("/about")}>
            About
          </button>
          <button className="footer-link" onClick={() => navigate("/login")}>
            Sign in
          </button>
        </div>
      </div>

      <div className="footer-bottom">
        <span>
          © {year} <strong>dsak789</strong> · AnyShare. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
