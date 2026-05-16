import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedLayout from "./components/ProtectedLayout";
import AuthPage from "./pages/AuthPage";
import MyFilesPage from "./pages/MyFilesPage";
import SharedPage from "./pages/SharedPage";
import UploadPage from "./pages/UploadPage";
import PinPage from "./pages/PinPage";
import ManageSharesPage from "./pages/ManageSharesPage";
import "./index.css";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/authentication" element={<AuthPage />} />
          <Route path="/" element={<ProtectedLayout><MyFilesPage /></ProtectedLayout>} />
          <Route path="/shared" element={<ProtectedLayout><SharedPage /></ProtectedLayout>} />
          <Route path="/upload" element={<ProtectedLayout><UploadPage /></ProtectedLayout>} />
          <Route path="/pin" element={<ProtectedLayout><PinPage /></ProtectedLayout>} />
          <Route path="/manage-shares" element={<ProtectedLayout><ManageSharesPage /></ProtectedLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
