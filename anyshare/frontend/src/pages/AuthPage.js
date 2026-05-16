import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";

export default function AuthPage() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const { user, login, register, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) return navigate("/");
  }, [user]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    let result;
    if (mode === "login") {
      result = await login(form.email, form.password);
    } else {
      if (!form.name.trim()) return setError("Name is required");
      result = await register(form.name, form.email, form.password);
    }
    if (result.ok) navigate("/");
    else setError(result.error);
  };

  return (
    <div className="auth-page">
      <div className="auth-bg" style={{ top: "-200px", right: "-200px" }} />
      <div className="auth-bg" style={{ bottom: "-200px", left: "-200px" }} />

      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🔐</div>
          <span className="logo-text">Any Share</span>
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
          {mode === "login" ? "Welcome back" : "Create account"}
        </h1>
        <p className="text-muted text-sm" style={{ marginBottom: 28 }}>
          {mode === "login"
            ? "Sign in to access your files"
            : "Set up your secure file vault"}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          {mode === "register" && (
            <div className="input-group">
              <label className="input-label">Full name</label>
              <input
                className="input"
                placeholder="AS AnyShare"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>
          )}
          <div className="input-group">
            <label className="input-label">Email</label>
            <input
              className="input"
              type="email"
              placeholder="as@anyshare.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              required
            />
          </div>
          <div className="input-group" style={{ marginBottom: 24 }}>
            <label className="input-label">Password</label>
            <input
              className="input"
              type="password"
              placeholder={
                mode === "register" ? "At least 7 characters" : "••••••••"
              }
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
          </div>

          <button
            className="btn btn-primary w-full"
            type="submit"
            disabled={loading}
            style={{ justifyContent: "center", padding: "13px" }}
          >
            {loading
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p
          className="text-sm text-muted"
          style={{ textAlign: "center", marginTop: 20 }}
        >
          {mode === "login" ? "No account? " : "Already registered? "}
          <button
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--accent2)",
              fontWeight: 600,
              fontFamily: "inherit",
              fontSize: 13,
            }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </p>

        <p
          className="text-sm text-muted"
          style={{ textAlign: "center", marginTop: 12 }}
        >
          <button
            onClick={() => navigate("/about")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text3)",
              fontFamily: "inherit",
              fontSize: 12,
            }}
          >
            What is AnyShare?
          </button>
        </p>
      </div>
      {/* <Footer minimal /> */}
    </div>
  );
}
