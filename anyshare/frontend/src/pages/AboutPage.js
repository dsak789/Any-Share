import React from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

const features = [
  {
    icon: "✉️",
    title: "Share with registered users",
    desc: "If the recipient has an AnyShare account, share directly by their email address. The file appears instantly in their Shared With Me tab — no extra steps, no PINs.",
  },
  {
    icon: "🔗",
    title: "Share with anyone via link + PIN",
    desc: "Generate a public link for anyone — no account needed. A system-generated PIN (e.g. AS-48291) is required to unlock it, preventing link misuse. Set an expiry and download limit too.",
  },
  {
    icon: "☁️",
    title: "Smart storage routing",
    desc: "Files under 100 MB are stored directly in the database for instant access. Larger files (up to 2 GB) are stored securely on the server filesystem. You never have to think about it.",
  },
  {
    icon: "👁",
    title: "In-app file preview",
    desc: "Preview images, PDFs, videos, audio, and text files right inside AnyShare without downloading. Open in a new tab for a full-screen view anytime.",
  },
  {
    icon: "🔐",
    title: "Secure by design",
    desc: "Passwords are hashed with bcrypt. Sessions use signed JWTs. PIN links are user-verified. Every download is access-checked. Your files are only available to people you explicitly allow.",
  },
  {
    icon: "🚫",
    title: "Full access control",
    desc: "Revoke email shares anytime. Delete anonymous links before they expire. Set download limits so a link can only be used a set number of times. You're always in control.",
  },
];

const steps = [
  {
    n: "01",
    title: "Create an account",
    desc: "Sign up with your email and a password. Takes 10 seconds.",
  },
  {
    n: "02",
    title: "Upload a file",
    desc: "Drag and drop any file up to 2 GB. AnyShare handles storage automatically.",
  },
  {
    n: "03",
    title: "Choose how to share",
    desc: "Share by email for registered users, or generate a link + PIN for anyone else.",
  },
  {
    n: "04",
    title: "Recipient accesses the file",
    desc: "Email share: it's waiting in their Shared With Me tab. Link share: they open the link, enter the PIN, and download.",
  },
  {
    n: "05",
    title: "Manage or revoke anytime",
    desc: "Head to Manage Shares to see all active shares, revoke email access, or delete links.",
  },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Nav bar */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          background: "rgba(10,10,15,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          padding: "0 40px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
          onClick={() => navigate("/")}
        >
          <div
            className="logo-icon"
            style={{ width: 30, height: 30, fontSize: 15 }}
          >
            🔐
          </div>
          <span className="logo-text">AnyShare</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/login")}
          >
            Sign in
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => navigate("/login")}
          >
            Get started
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          textAlign: "center",
          padding: "80px 24px 64px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 600,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(108,99,255,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            display: "inline-block",
            padding: "6px 16px",
            borderRadius: 20,
            background: "rgba(108,99,255,0.15)",
            border: "1px solid rgba(108,99,255,0.3)",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--accent2)",
            letterSpacing: 1,
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Secure · Simple · Yours
        </div>
        <h1
          style={{
            fontSize: "clamp(32px, 6vw, 56px)",
            fontWeight: 800,
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
            marginBottom: 20,
            background: "linear-gradient(135deg, #fff 40%, var(--accent2))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          File sharing that actually
          <br />
          respects your files
        </h1>
        <p
          style={{
            fontSize: 17,
            color: "var(--text2)",
            maxWidth: 520,
            margin: "0 auto 32px",
            lineHeight: 1.7,
          }}
        >
          AnyShare lets you store, preview, and share files securely — with
          teammates who have accounts, or with anyone in the world via a
          protected link.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/login")}
          style={{ padding: "13px 28px", fontSize: 15 }}
        >
          Start for free →
        </button>
      </section>

      {/* What is AnyShare */}
      <section
        style={{
          padding: "0 24px 72px",
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div className="card" style={{ padding: "32px 36px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
            What is AnyShare?
          </h2>
          <p style={{ color: "var(--text2)", lineHeight: 1.8, fontSize: 15 }}>
            AnyShare is a self-hosted file vault with two sharing modes built
            in. Whether you're collaborating with a registered teammate or
            sending a file to a client who's never heard of AnyShare, we've got
            a path for both — without compromising security.
          </p>
          <p
            style={{
              color: "var(--text2)",
              lineHeight: 1.8,
              fontSize: 15,
              marginTop: 12,
            }}
          >
            Files are stored smartly: small files live in the database for
            instant retrieval, large files go to server storage. You can preview
            compatible files in-app, download any time, and revoke access with
            one click.
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: "0 24px 80px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 26,
              fontWeight: 800,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Everything you need
          </h2>
          <p
            style={{
              textAlign: "center",
              color: "var(--text2)",
              fontSize: 14,
              marginBottom: 40,
            }}
          >
            No bloat. No unnecessary complexity.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {features.map((f) => (
              <div key={f.title} className="card" style={{ padding: 24 }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                  {f.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    lineHeight: 1.7,
                  }}
                >
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        style={{
          padding: "0 24px 80px",
          maxWidth: 680,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <h2
          style={{
            fontSize: 26,
            fontWeight: 800,
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          How it works
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--text2)",
            fontSize: 14,
            marginBottom: 40,
          }}
        >
          Five steps, start to finish.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {steps.map((s, i) => (
            <div
              key={s.n}
              style={{ display: "flex", gap: 20, alignItems: "flex-start" }}
            >
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background:
                      "linear-gradient(135deg, var(--accent), var(--accent2))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {s.n}
                </div>
                {i < steps.length - 1 && (
                  <div
                    style={{
                      width: 2,
                      height: 32,
                      background: "var(--border)",
                      margin: "4px auto",
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  paddingTop: 10,
                  paddingBottom: i < steps.length - 1 ? 0 : 0,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  {s.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text2)",
                    lineHeight: 1.7,
                  }}
                >
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign: "center", padding: "0 24px 80px" }}>
        <div
          style={{
            display: "inline-block",
            padding: "40px 48px",
            borderRadius: 16,
            background:
              "linear-gradient(135deg, rgba(108,99,255,0.15), rgba(167,139,250,0.08))",
            border: "1px solid rgba(108,99,255,0.25)",
          }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
            Ready to start?
          </h2>
          <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 24 }}>
            Create a free account and upload your first file in under a minute.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate("/login")}
            style={{ padding: "12px 28px" }}
          >
            Create account →
          </button>
        </div>
      </section>

      {/* <Footer /> */}
    </div>
  );
}
