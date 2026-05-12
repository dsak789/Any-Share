import React, { useState } from "react";
import "./LoginScreen.css";

export default function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(password);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed.");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-logo">
          <span className="login-logo-icon">▣</span>
          <span className="login-logo-text">MY VAULT</span>
        </div>
        <p className="login-sub">Enter your password to continue</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className={`login-input ${error ? "login-input-error" : ""}`}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading || !password}>
            {loading ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
