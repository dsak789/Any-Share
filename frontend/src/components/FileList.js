import React from "react";
import "./FileList.css";
import { downloadUrl } from "../api";

const ICONS = {
  image: "🖼",
  video: "🎬",
  audio: "🎵",
  pdf: "📄",
  zip: "📦",
  text: "📝",
  spreadsheet: "📊",
  default: "📁",
};

function fileIcon(mimeType) {
  if (!mimeType) return ICONS.default;
  if (mimeType.startsWith("image/")) return ICONS.image;
  if (mimeType.startsWith("video/")) return ICONS.video;
  if (mimeType.startsWith("audio/")) return ICONS.audio;
  if (mimeType === "application/pdf") return ICONS.pdf;
  if (
    mimeType.includes("zip") ||
    mimeType.includes("tar") ||
    mimeType.includes("gzip")
  )
    return ICONS.zip;
  if (mimeType.startsWith("text/")) return ICONS.text;
  if (mimeType.includes("sheet") || mimeType.includes("excel"))
    return ICONS.spreadsheet;
  return ICONS.default;
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FileList({ files, onDelete }) {
  if (!files.length) {
    return (
      <div className="file-list-empty">
        <span className="empty-icon">🗄</span>
        <p>No files uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="file-list">
      <div className="file-list-header">
        <span>Name</span>
        <span>Size</span>
        <span>Uploaded</span>
        <span>Actions</span>
      </div>
      {files.map((f) => (
        <div className="file-row" key={f.id}>
          <div className="file-name">
            <span className="file-type-icon">{fileIcon(f.mimeType)}</span>
            <span className="file-label" title={f.originalName}>
              {f.originalName}
            </span>
          </div>
          <span className="file-size">{formatSize(f.size)}</span>
          <span className="file-date">{formatDate(f.uploadedAt)}</span>
          <div className="file-actions">
            <a
              className="btn btn-ghost"
              href={downloadUrl(f.id)}
              download={f.originalName}
              title="Download"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download
            </a>
            <button
              className="btn btn-danger"
              onClick={() => onDelete(f.id)}
              title="Delete"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
