import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import UploadZone from "./components/UploadZone";
import FileList from "./components/FileList";
import Toast from "./components/Toast";
import { uploadFiles, listFiles, deleteFile } from "./api";

export default function App() {
  const [files, setFiles]         = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [toast, setToast]         = useState(null);
  const [loading, setLoading]     = useState(true);

  const showToast = (message, type = "info") =>
    setToast({ message, type, key: Date.now() });

  const fetchFiles = useCallback(async () => {
    try {
      const { data } = await listFiles();
      setFiles(data.files);
    } catch {
      showToast("Could not load files. Is the server running?", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const handleUpload = async (selected) => {
    setUploading(true);
    setProgress(0);
    try {
      await uploadFiles(selected, setProgress);
      showToast(`${selected.length} file${selected.length > 1 ? "s" : ""} uploaded.`, "success");
      await fetchFiles();
    } catch (err) {
      const msg = err.response?.data?.error || "Upload failed.";
      showToast(msg, "error");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      showToast("File deleted.", "success");
    } catch {
      showToast("Delete failed.", "error");
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">▣</span>
            <span className="logo-text">VAULT</span>
          </div>
          <div className="header-meta">
            <span className="file-count">
              {loading ? "—" : files.length} file{files.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="app-main">
        <section className="section">
          <h2 className="section-label">Upload</h2>
          <UploadZone
            onFilesSelected={handleUpload}
            uploading={uploading}
            progress={progress}
          />
        </section>

        <section className="section">
          <h2 className="section-label">
            Stored Files
            {!loading && (
              <button className="refresh-btn" onClick={fetchFiles} title="Refresh">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/>
                </svg>
              </button>
            )}
          </h2>
          {loading ? (
            <div className="loading-state">
              <span className="loading-dot" />
              <span className="loading-dot" />
              <span className="loading-dot" />
            </div>
          ) : (
            <FileList files={files} onDelete={handleDelete} />
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span>VAULT · File Storage · v1.0</span>
      </footer>

      {/* Toast */}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
