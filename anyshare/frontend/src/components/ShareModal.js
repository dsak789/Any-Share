import React, { useState } from "react";
import { createShare } from "../utils/api";

export default function ShareModal({ file, onClose }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleShare = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await createShare({ fileId: file.fileId, granteeEmail: email });
      setResult(res.data.share);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create share");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {!result ? (
          <>
            <div className="modal-title">🔗 Share file</div>
            <div className="modal-subtitle">&ldquo;{file.originalName}&rdquo;</div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleShare}>
              <div className="input-group">
                <label className="input-label">Recipient's email address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  required
                  autoFocus
                />
                <span className="text-xs text-muted">They must already have an account in FileVault.</span>
              </div>

              <div className="flex gap-2" style={{ justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? "Generating PIN…" : "Generate PIN & share"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="modal-title">✅ Share created</div>
            <div className="modal-subtitle">Share this PIN with {result.granteeName}</div>

            <div className="alert alert-info" style={{ marginBottom: 20 }}>
              Send the PIN below to <strong>{result.granteeEmail}</strong>. They can enter it in the &ldquo;Enter PIN&rdquo; section to download the file.
            </div>

            <div className="pin-display">
              {result.pin.split("").map((d, i) => (
                <div key={i} className="pin-digit">{d}</div>
              ))}
            </div>
            <p className="text-xs text-muted" style={{ textAlign: "center", marginBottom: 20 }}>
              You can revoke access anytime from Manage Shares.
            </p>

            <div className="flex gap-2" style={{ justifyContent: "flex-end" }}>
              <button
                className="btn btn-ghost"
                onClick={() => navigator.clipboard.writeText(result.pin)}>
                📋 Copy PIN
              </button>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
