import React, { useState } from "react";
import { createEmailShare, createLinkShare } from "../utils/api";
import { formatBytes } from "../utils/fileUtils";

export default function ShareModal({ file, onClose }) {
  const [tab, setTab] = useState("email"); // "email" | "link"

  // Email share state
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [emailDone, setEmailDone] = useState(null);

  // Link share state
  const [expiryDays, setExpiryDays] = useState("7");
  const [maxDownloads, setMaxDownloads] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [linkDone, setLinkDone] = useState(null);

  const handleEmailShare = async (e) => {
    e.preventDefault();
    setEmailLoading(true);
    setEmailError("");
    try {
      const res = await createEmailShare({ fileId: file.fileId, granteeEmail: email });
      setEmailDone(res.data.share);
    } catch (err) {
      setEmailError(err.response?.data?.error || "Failed to share");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleLinkShare = async () => {
    setLinkLoading(true);
    setLinkError("");
    try {
      const res = await createLinkShare({
        fileId: file.fileId,
        expiryDays: expiryDays || null,
        maxDownloads: maxDownloads || null,
      });
      setLinkDone(res.data);
    } catch (err) {
      setLinkError(err.response?.data?.error || "Failed to create link");
    } finally {
      setLinkLoading(false);
    }
  };

  const copyToClipboard = (text) => navigator.clipboard.writeText(text);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ marginBottom: 20 }}>
          <div className="modal-title">Share file</div>
          <div className="modal-subtitle" style={{ marginBottom: 0 }}>
            {file.originalName} &middot; {formatBytes(file.size)}
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: "flex", gap: 4, background: "var(--surface2)", padding: 4, borderRadius: "var(--radius-sm)", marginBottom: 20 }}>
          {[
            { key: "email", icon: "✉️", label: "Registered user" },
            { key: "link", icon: "🔗", label: "Anonymous link" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: "8px 12px", border: "none", borderRadius: 6,
                fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: tab === t.key ? "var(--surface)" : "transparent",
                color: tab === t.key ? "var(--text)" : "var(--text2)",
                boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.3)" : "none",
                transition: "all 0.15s",
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Email tab ── */}
        {tab === "email" && (
          <>
            {!emailDone ? (
              <>
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Share directly with someone who has an AnyShare account. The file will appear in their "Shared With Me" tab immediately.
                </p>
                {emailError && <div className="alert alert-error">{emailError}</div>}
                <form onSubmit={handleEmailShare}>
                  <div className="input-group">
                    <label className="input-label">Recipient's email</label>
                    <input
                      className="input" type="email" placeholder="colleague@example.com"
                      value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                      required autoFocus
                    />
                    <span className="text-xs text-muted">Must have an AnyShare account.</span>
                  </div>
                  <div className="flex gap-2" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                    <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={emailLoading}>
                      {emailLoading ? "Sharing…" : "✉️ Share access"}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="alert alert-success">
                  ✅ File shared with <strong>{emailDone.granteeName}</strong> ({emailDone.granteeEmail}). They can access it immediately in their Shared With Me tab.
                </div>
                <div className="flex gap-2" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                  <button className="btn btn-ghost" onClick={() => { setEmailDone(null); setEmail(""); }}>Share with another</button>
                  <button className="btn btn-primary" onClick={onClose}>Done</button>
                </div>
              </>
            )}
          </>
        )}

        {/* ── Link tab ── */}
        {tab === "link" && (
          <>
            {!linkDone ? (
              <>
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Generate a shareable link + PIN for anyone — no account needed. The PIN prevents link misuse.
                </p>
                {linkError && <div className="alert alert-error">{linkError}</div>}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Link expires in</label>
                    <select
                      className="input"
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(e.target.value)}
                      style={{ cursor: "pointer" }}>
                      <option value="3">3 days</option>
                      <option value="7">7 days</option>
                      <option value="15">15 days</option>
                      <option value="">No expiry</option>
                    </select>
                  </div>
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Max downloads</label>
                    <select
                      className="input"
                      value={maxDownloads}
                      onChange={(e) => setMaxDownloads(e.target.value)}
                      style={{ cursor: "pointer" }}>
                      <option value="">No limit</option>
                      {[1,2,3,5,10].map(n => <option key={n} value={n}>{n} download{n>1?"s":""}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
                  <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                  <button className="btn btn-primary" onClick={handleLinkShare} disabled={linkLoading}>
                    {linkLoading ? "Generating…" : "🔗 Generate link & PIN"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="alert alert-success" style={{ marginBottom: 16 }}>
                  ✅ Link created! Share the URL and PIN separately for security.
                </div>

                <div className="input-group">
                  <label className="input-label">Shareable link</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input font-mono" readOnly value={linkDone.url} style={{ fontSize: 12 }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(linkDone.url)} style={{ flexShrink: 0 }}>Copy</button>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">PIN (share separately)</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div className="pin-display" style={{ margin: 0, justifyContent: "flex-start", gap: 4 }}>
                      {linkDone.pin.split("").map((c, i) => (
                        <div key={i} className="pin-digit" style={{ width: c === "-" ? 20 : 36, height: 44, fontSize: c === "-" ? 14 : 20, color: c === "-" ? "var(--text3)" : "var(--accent2)" }}>{c}</div>
                      ))}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => copyToClipboard(linkDone.pin)}>Copy PIN</button>
                  </div>
                </div>

                {(linkDone.expiresAt || linkDone.maxDownloads) && (
                  <div className="alert alert-info" style={{ fontSize: 12, marginTop: 4 }}>
                    {linkDone.expiresAt && <>⏱ Expires: {new Date(linkDone.expiresAt).toLocaleDateString()}</>}
                    {linkDone.expiresAt && linkDone.maxDownloads && " · "}
                    {linkDone.maxDownloads && <>⬇️ Max {linkDone.maxDownloads} download{linkDone.maxDownloads > 1 ? "s" : ""}</>}
                  </div>
                )}

                <div className="flex gap-2" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                  <button className="btn btn-ghost" onClick={() => setLinkDone(null)}>Create another</button>
                  <button className="btn btn-primary" onClick={onClose}>Done</button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
