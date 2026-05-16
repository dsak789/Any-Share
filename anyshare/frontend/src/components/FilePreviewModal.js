import React from "react";
import { previewUrl } from "../utils/api";
import { formatBytes } from "../utils/fileUtils";

const PREVIEWABLE = {
  image: ["image/jpeg","image/png","image/gif","image/webp","image/svg+xml","image/bmp"],
  video: ["video/mp4","video/webm","video/ogg"],
  audio: ["audio/mpeg","audio/wav","audio/ogg","audio/mp4"],
  pdf:   ["application/pdf"],
  text:  ["text/plain","text/csv","text/html","text/css","text/javascript",
          "application/json","application/xml","text/markdown","text/xml"],
};

function getPreviewType(mimeType = "") {
  for (const [type, mimes] of Object.entries(PREVIEWABLE)) {
    if (mimes.includes(mimeType) || (type === "text" && mimeType.startsWith("text/"))) return type;
  }
  return null;
}

export default function FilePreviewModal({ file, onClose }) {
  const url = previewUrl(file.fileId);
  const previewType = getPreviewType(file.mimeType);
  const token = localStorage.getItem("fv_token");
  // Append token as query param for preview iframe/img src usage
  const authUrl = `${url}?token=${token}`;

  const openInNewTab = () => window.open(authUrl, "_blank");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ alignItems: "flex-start", paddingTop: 40 }}>
      <div className="modal" style={{ maxWidth: 860, width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{file.originalName}</div>
            <div className="text-xs text-muted">{formatBytes(file.size)} · {file.mimeType}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={openInNewTab}>↗ Open in new tab</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
          </div>
        </div>

        {/* Preview area */}
        <div style={{
          background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)",
          minHeight: 300, maxHeight: "65vh", overflow: "auto",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {!previewType && (
            <div className="empty-state" style={{ padding: 48 }}>
              <div className="empty-icon">📦</div>
              <div className="empty-title">Preview not available</div>
              <div className="empty-desc">This file type ({file.mimeType || "unknown"}) cannot be previewed in the browser.</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openInNewTab}>
                ↗ Try opening directly
              </button>
            </div>
          )}

          {previewType === "image" && (
            <img
              src={authUrl} alt={file.originalName}
              style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain", borderRadius: 8 }}
            />
          )}

          {previewType === "video" && (
            <video controls style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: 8 }}>
              <source src={authUrl} type={file.mimeType} />
              Your browser does not support video playback.
            </video>
          )}

          {previewType === "audio" && (
            <div style={{ padding: 32, textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎵</div>
              <div style={{ fontWeight: 600, marginBottom: 16 }}>{file.originalName}</div>
              <audio controls style={{ width: "100%", maxWidth: 400 }}>
                <source src={authUrl} type={file.mimeType} />
              </audio>
            </div>
          )}

          {previewType === "pdf" && (
            <iframe
              src={authUrl}
              title={file.originalName}
              style={{ width: "100%", height: "65vh", border: "none", borderRadius: 8 }}
            />
          )}

          {previewType === "text" && (
            <TextPreview url={authUrl} />
          )}
        </div>
      </div>
    </div>
  );
}

// Fetch and display text content
function TextPreview({ url }) {
  const [content, setContent] = React.useState(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    const token = localStorage.getItem("fv_token");
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.text())
      .then(setContent)
      .catch(() => setError(true));
  }, [url]);

  if (error) return <div className="text-muted text-sm" style={{ padding: 24 }}>Failed to load text content.</div>;
  if (content === null) return <div className="text-muted text-sm" style={{ padding: 24 }}>Loading…</div>;

  return (
    <pre style={{
      width: "100%", maxHeight: "65vh", overflow: "auto",
      padding: 24, margin: 0,
      fontFamily: "JetBrains Mono, monospace", fontSize: 13, lineHeight: 1.7,
      color: "var(--text)", whiteSpace: "pre-wrap", wordBreak: "break-word",
    }}>
      {content}
    </pre>
  );
}
