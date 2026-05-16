import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { uploadFile } from "../utils/api";
import { formatBytes } from "../utils/fileUtils";

const LARGE_THRESHOLD = 100 * 1024 * 1024; // 100 MB (mirrors backend)

export default function UploadPage() {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();
  const navigate = useNavigate();

  const pickFile = (f) => {
    if (!f) return;
    setFile(f);
    setDone(null);
    setError("");
    setProgress(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadFile(fd, setProgress);
      setDone(res.data.file);
      setFile(null);
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Upload File</h1>
        <p className="page-subtitle">Files under 100 MB are stored in the database; larger files stay on the server.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {done && (
        <div className="alert alert-success">
          ✅ &ldquo;{done.originalName}&rdquo; uploaded successfully ({formatBytes(done.size)}) —
          stored {done.storageType === "disk" ? "on disk 💾" : "in DynamoDB ☁️"}.
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/")}>View my files</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setDone(null); setProgress(0); }}>Upload another</button>
          </div>
        </div>
      )}

      {!done && (
        <>
          <div
            className={`upload-zone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current.click()}>
            <input
              ref={inputRef}
              type="file"
              style={{ display: "none" }}
              onChange={(e) => pickFile(e.target.files[0])}
            />
            <div className="upload-icon">📂</div>
            {file ? (
              <>
                <div className="upload-text">{file.name}</div>
                <div className="upload-hint">
                  {formatBytes(file.size)} · {file.size >= LARGE_THRESHOLD ? "Will be stored on disk 💾" : "Will be stored in DynamoDB ☁️"}
                </div>
              </>
            ) : (
              <>
                <div className="upload-text">Drop a file here, or click to browse</div>
                <div className="upload-hint">Any file type · Up to 2 GB</div>
              </>
            )}
          </div>

          {uploading && (
            <div style={{ marginTop: 12 }}>
              <div className="flex justify-between text-sm text-muted mb-4">
                <span>Uploading…</span><span>{progress}%</span>
              </div>
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {file && !uploading && (
            <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={handleUpload}>⬆️ Upload</button>
              <button className="btn btn-ghost" onClick={() => { setFile(null); setProgress(0); }}>Cancel</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
