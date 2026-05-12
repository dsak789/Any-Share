import axios from "axios";

// Token is stored in localStorage so it survives page refreshes.
// Key used to read/write it:
const TOKEN_KEY = "vault_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const saveToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

// Axios instance — attaches token automatically to every request
const api = axios.create({ baseURL: "http://server.dsak.in:5000/api" });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// ── Auth ─────────────────────────────────────────────────────────────────────
export const login = async (password) => {
  const { data } = await api.post("/login", { password });
  saveToken(data.token);
};

export const logout = async () => {
  await api.post("/logout").catch(() => {});
  clearToken();
};

export const checkMe = () => api.get("/me");

// ── Files ─────────────────────────────────────────────────────────────────────
export const uploadFiles = (files, onProgress) => {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return api.post("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
};

export const listFiles = () => api.get("/files");
export const deleteFile = (id) => api.delete(`/files/${id}`);
export const downloadUrl = (id) => `http://server.dsak.in:5000/api/download/${id}`;
export const getSystemInfo = () => api.get("/system");
