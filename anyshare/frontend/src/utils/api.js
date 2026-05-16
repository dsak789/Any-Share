import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:9999",
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fv_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes("/public/")) {
      localStorage.removeItem("fv_token");
      localStorage.removeItem("fv_user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

const BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register = (data) => api.post("/api/auth/register", data);
export const login = (data) => api.post("/api/auth/login", data);
export const getMe = () => api.get("/api/auth/me");

// ── Files ─────────────────────────────────────────────────────────────────────
export const uploadFile = (formData, onProgress) =>
  api.post("/api/files/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => onProgress && onProgress(Math.round((e.loaded / e.total) * 100)),
  });

export const listMyFiles = () => api.get("/api/files");
export const listSharedFiles = () => api.get("/api/files/shared");
export const downloadFile = (fileId) =>
  api.get(`/api/files/${fileId}/download`, { responseType: "blob" });
export const deleteFile = (fileId) => api.delete(`/api/files/${fileId}`);

// Returns a URL string for use in <img>, <video>, <iframe> etc.
export const previewUrl = (fileId) => `${BASE}/api/files/${fileId}/preview`;

// ── Email Shares (registered users) ──────────────────────────────────────────
export const createEmailShare = (data) => api.post("/api/shares/email", data);
export const listMyShares = () => api.get("/api/shares/my-shares");
export const revokeEmailShare = (fileId, granteeId) =>
  api.delete(`/api/shares/email/${fileId}/${granteeId}`);

// ── Link Shares (anonymous / public) ─────────────────────────────────────────
export const createLinkShare = (data) => api.post("/api/shares/link", data);
export const listMyLinks = () => api.get("/api/shares/my-links");
export const deleteLinkShare = (linkId) => api.delete(`/api/shares/link/${linkId}`);

// ── Public (no auth needed) ───────────────────────────────────────────────────
export const getPublicLinkInfo = (linkId) => api.get(`/api/public/public/${linkId}`);
export const verifyPublicPin = (linkId, pin) =>
  api.post(`/api/public/public/${linkId}/verify`, { pin });
export const publicDownloadUrl = (linkId, pin) =>
  `${BASE}/api/public/public/${linkId}/download?pin=${encodeURIComponent(pin)}`;

export default api;
