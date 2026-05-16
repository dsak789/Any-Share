import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { validatePin, downloadFile } from "../utils/api";
import { formatBytes, fileIcon, triggerDownload } from "../utils/fileUtils";

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const navigate = useNavigate();

  const handleValidate = async (e) => {
    e.preventDefault();
    if (pin.length !== 6) return setError("Enter all 6 digits");
    setLoading(true);
    setError("");
    try {
      const res = await validatePin(pin);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid PIN");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await downloadFile(result.file.fileId);
      triggerDownload(res.data, result.file.originalName);
    } catch {
      setError("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const digits = pin.split("").concat(Array(6 - pin.length).fill(""));

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Enter PIN</h1>
        <p className="page-subtitle">Enter the 6-digit PIN to access a shared file</p>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        {error && <div className="alert alert-error">{error}</div>}

        {!result ? (
          <form onSubmit={handleValidate}>
            <div style={{ marginBottom: 24 }}>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                File owners can share a PIN with you. Enter it below to unlock access.
              </p>
              <div className="pin-display">
                {digits.map((d, i) => (
                  <div key={i} className="pin-digit">{d || <span style={{ color: "var(--text3)" }}>·</span>}</div>
                ))}
              </div>
              <input
                className="input font-mono"
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                placeholder="Type 6-digit PIN"
                value={pin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPin(v);
                  setError("");
                }}
                style={{ textAlign: "center", fontSize: 20, letterSpacing: 8 }}
              />
            </div>
            <button className="btn btn-primary w-full" type="submit" disabled={loading || pin.length !== 6}
              style={{ justifyContent: "center" }}>
              {loading ? "Validating…" : "🔓 Unlock file"}
            </button>
          </form>
        ) : (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 20 }}>
              ✅ PIN accepted! You can now download this file.
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", marginBottom: 20 }}>
              <span style={{ fontSize: 32 }}>{fileIcon(result.file.mimeType, result.file.originalName)}</span>
              <div>
                <div className="file-name">{result.file.originalName}</div>
                <div className="text-muted text-sm">{formatBytes(result.file.size)} · Shared by {result.file.ownerName}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
                {downloading ? "Downloading…" : "⬇️ Download file"}
              </button>
              <button className="btn btn-ghost" onClick={() => navigate("/shared")}>
                View all shared
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
