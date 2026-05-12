import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import UploadZone from "./components/UploadZone";
import FileList from "./components/FileList";
import Toast from "./components/Toast";
import LoginScreen from "./components/LoginScreen";
import SystemInfo from "./components/SystemInfo";
import {
  uploadFiles,
  listFiles,
  deleteFile,
  login,
  logout,
  checkMe,
} from "./api";

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("files");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);

  const showToast = useCallback(
    (message, type = "info") => setToast({ message, type, key: Date.now() }),
    [],
  ); // stable — only setToast in deps

  // Check existing token on mount
  useEffect(() => {
    checkMe()
      .then(({ data }) => setAuthed(data.authenticated))
      .catch(() => setAuthed(false))
      .finally(() => setAuthReady(true));
  }, []);

  // fetchFiles is stable — no showToast reference inside useCallback deps
  const fetchFiles = useCallback(async () => {
    try {
      const { data } = await listFiles();
      setFiles(data.files);
    } catch {
      setToast({
        message: "Could not load files. Is the server running?",
        type: "error",
        key: Date.now(),
      });
    } finally {
      setLoading(false);
    }
  }, []); // empty deps — setFiles and setToast are always stable

  useEffect(() => {
    if (authed) fetchFiles();
  }, [authed, fetchFiles]);

  const handleLogin = async (password) => {
    await login(password);
    setAuthed(true);
  };

  const handleLogout = async () => {
    await logout();
    setAuthed(false);
    setFiles([]);
  };

  const handleUpload = async (selected) => {
    setUploading(true);
    setProgress(0);
    try {
      await uploadFiles(selected, setProgress);
      showToast(
        `${selected.length} file${selected.length > 1 ? "s" : ""} uploaded.`,
        "success",
      );
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

  // Don't render anything until we've checked the session
  if (!authReady) return null;

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">▣</span>
            <span className="logo-text"> My VAULT</span>
          </div>
          <nav className="tab-bar">
            <button
              className={`tab-btn ${tab === "files" ? "tab-active" : ""}`}
              onClick={() => setTab("files")}
            >
              Files
            </button>
            <button
              className={`tab-btn ${tab === "system" ? "tab-active" : ""}`}
              onClick={() => setTab("system")}
            >
              System
            </button>
          </nav>
          <div className="header-right">
            <span className="file-count">
              {loading ? "—" : files.length} file{files.length !== 1 ? "s" : ""}
            </span>
            <button
              className="logout-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {tab === "files" && (
          <>
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
                  <button
                    className="refresh-btn"
                    onClick={fetchFiles}
                    title="Refresh"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
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
          </>
        )}

        {tab === "system" && (
          <section className="section">
            <h2 className="section-label">System Information</h2>
            <SystemInfo />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <span>My VAULT · v1.1 · File Storage · ©️ 2025 · DSAK </span>
      </footer>

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
