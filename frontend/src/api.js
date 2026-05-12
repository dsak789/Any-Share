import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000/api",
  withCredentials: true, // send the session cookie on every request
});

export const login = (password) => api.post("/login", { password });
export const logout = () => api.post("/logout");
export const checkMe = () => api.get("/me");

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
export const downloadUrl = (id) => `http://localhost:5000/api/download/${id}`;
export const getSystemInfo = () => api.get("/system");
