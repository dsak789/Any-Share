import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicLinkInfo, verifyPublicPin, publicDownloadUrl } from "../utils/api";
import { formatBytes, fileIcon } from "../utils/fileUtils";

export default function PublicSharePage() {
  const { linkId } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [pinError, setPinError] = useState("");
  const [unlocked, setUnlocked] = useState(null); // { fileId, fileName, fileMimeType, fileSize }

  useEffect(() => {
    getPublicLinkInfo(linkId)
      .then((res) => setInfo(res.data))
      .catch(() => setInfo({ notFound: true }))
      .finally(() => setLoading(false));
  }, [linkId]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setPinError("");
    try {
      const res = await verifyPublicPin(linkId, pin);
      setUnlocked(res.data);
    } catch (err) {
      setPinError(err.response?.data?.error || "Incorrect PIN");
    } finally {
      setVerifying(false);
    }
  };

  const handleDownload = () => {
    const url = publicDownloadUrl(linkId, pin);
    window.location.href = url;
  };

  const pinChars = pin.toUpperCase().split("");

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }}>
      {/* Background glow */}
      <div style={{
        position: "fixed", top: "-150px", right: "-150px",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(108,99,255,0.12) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 480 }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 32 }}>
          <div className="logo-icon">🔐</div>
          <span className="logo-text">AnyShare</span>
        </div>

        <div className="card">
          {loading && (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-icon">⏳</div>
              <div className="empty-title">Loading…</div>
            </div>
          )}

          {!loading && info?.notFound && (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-icon">🔍</div>
              <div className="empty-title">Link not found</div>
              <div className="empty-desc">This share link doesn't exist or has been deleted.</div>
            </div>
          )}

          {!loading && info?.expired && (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-icon">⏰</div>
              <div className="empty-title">Link expired</div>
              <div className="empty-desc" style={{ marginBottom: 12 }}>
                {info.ownerName} shared a file with you, but this link has expired or reached its download limit.
              </div>
              <div className="text-xs text-muted">
                {info.expiresAt && <>Expired: {new Date(info.expiresAt).toLocaleDateString()}</>}
                {info.maxDownloads && <> · Limit: {info.maxDownloads} download{info.maxDownloads > 1 ? "s" : ""}</>}
              </div>
            </div>
          )}

          {!loading && info && !info.notFound && !info.expired && (
            <>
              {/* File info */}
              <div style={{ marginBottom: 24 }}>
                <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
                  <strong style={{ color: "var(--accent2)" }}>{info.ownerName}</strong> shared a file with you
                </p>
                <div style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: 16, background: "var(--surface2)", borderRadius: "var(--radius-sm)",
                }}>
                  <span style={{ fontSize: 36 }}>{fileIcon(info.fileMimeType, info.fileName)}</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "var(--text)" }}>{info.fileName}</div>
                    <div className="text-xs text-muted">{formatBytes(info.fileSize)}</div>
                  </div>
                </div>
                {(info.expiresAt || info.maxDownloads) && (
                  <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                    {info.expiresAt && <>⏱ Expires {new Date(info.expiresAt).toLocaleDateString()}</>}
                    {info.expiresAt && info.maxDownloads && " · "}
                    {info.maxDownloads && <>⬇️ {info.downloadCount}/{info.maxDownloads} downloads used</>}
                  </div>
                )}
              </div>

              {!unlocked ? (
                <>
                  <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                    Enter the PIN to access this file. The person who shared it should have sent it to you separately.
                  </p>

                  {/* PIN visual */}
                  <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
                    {["A","S","-","_","_","_","_","_"].map((placeholder, i) => {
                      const char = i < pinChars.length ? pinChars[i] : null;
                      return (
                        <div key={i} className="pin-digit" style={{
                          width: placeholder === "-" ? 20 : 38, height: 48,
                          fontSize: placeholder === "-" ? 14 : 18,
                          color: char ? "var(--accent2)" : "var(--text3)",
                          opacity: placeholder === "-" ? 0.5 : 1,
                        }}>
                          {char || (placeholder !== "_" ? placeholder : "·")}
                        </div>
                      );
                    })}
                  </div>

                  {pinError && <div className="alert alert-error">{pinError}</div>}

                  <form onSubmit={handleVerify}>
                    <div className="input-group">
                      <input
                        className="input font-mono"
                        placeholder="AS-XXXXX"
                        value={pin}
                        maxLength={8}
                        onChange={(e) => { setPin(e.target.value.toUpperCase()); setPinError(""); }}
                        style={{ textAlign: "center", fontSize: 20, letterSpacing: 4 }}
                        autoFocus
                      />
                    </div>
                    <button className="btn btn-primary w-full" type="submit"
                      disabled={verifying || pin.length < 7}
                      style={{ justifyContent: "center", marginTop: 4 }}>
                      {verifying ? "Verifying…" : "🔓 Unlock file"}
                    </button>
                  </form>
                </>
              ) : (
                <div>
                  <div className="alert alert-success" style={{ marginBottom: 16 }}>
                    ✅ PIN verified! You can download this file.
                  </div>

                  {/* Small inline preview for images */}
                  {unlocked.fileMimeType?.startsWith("image/") && (
                    <div style={{ marginBottom: 16, textAlign: "center" }}>
                      <img
                        src={publicDownloadUrl(linkId, pin)}
                        alt={unlocked.fileName}
                        style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 8, border: "1px solid var(--border)" }}
                      />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={handleDownload}>
                      ⬇️ Download file
                    </button>
                  </div>
                  <p className="text-xs text-muted" style={{ textAlign: "center", marginTop: 12 }}>
                    Want to create your own vault? <a href="/login" style={{ color: "var(--accent2)" }}>Join AnyShare</a>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
