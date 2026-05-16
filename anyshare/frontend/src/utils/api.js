import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  timeout: 120000,
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("fv_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("fv_token");
      localStorage.removeItem("fv_user");
      window.location.href = "/authentication";
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
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

// ── Shares ────────────────────────────────────────────────────────────────────
export const createShare = (data) => api.post("/api/shares", data);
export const validatePin = (pin) => api.post("/api/shares/validate-pin", { pin });
export const listMyShares = () => api.get("/api/shares/my-shares");
export const revokeShare = (fileId, granteeId) =>
  api.delete(`/api/shares/${fileId}/${granteeId}`);

export default api;
