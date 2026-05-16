import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import HamburgerMenu from "./HamburgerMenu";

export default function ProtectedLayout({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <HamburgerMenu />
      <main className="main-content">{children}</main>
    </div>
  );
}
