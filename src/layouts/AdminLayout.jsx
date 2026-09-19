import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AIAssistant from "../components/AIAssistant";

function AdminLayout() {

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-layout">

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        closeSidebar={() => setSidebarOpen(false)}
      />

      {/* Main Area */}
      <div className="main-section">

        {/* Top Navigation */}
        <Topbar
          toggleSidebar={() =>
            setSidebarOpen(!sidebarOpen)
          }
        />

        {/* Page Content */}
        <main className="page-content">
          <Outlet />
        </main>

      </div>

      {/* Floating AI Assistant */}
      <AIAssistant />

    </div>
  );
}

export default AdminLayout;