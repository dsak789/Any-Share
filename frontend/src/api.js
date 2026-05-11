import axios from "axios";

const api = axios.create({ baseURL: "/api" });

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
