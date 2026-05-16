import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Sidebar from "./Sidebar";
import HamburgerMenu from "./HamburgerMenu";
import Footer from "./Footer";

export default function ProtectedLayout({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/authentication" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <HamburgerMenu />
      <main className="main-content">{children}</main>
      {/* <div style={{ marginLeft: 0, paddingLeft: 40, paddingRight: 40 }}>
        <Footer minimal />
      </div> */}
    </div>
  );
}
