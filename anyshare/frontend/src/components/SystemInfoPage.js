import React from "react";
import SystemInfo from "../components/SystemInfo";

export default function SystemInfoPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">System</h1>
        <p className="page-subtitle">
          Live server, database, and runtime diagnostics
        </p>
      </div>
      <SystemInfo />
    </div>
  );
}
