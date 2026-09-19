import {
  LayoutDashboard,
  BriefcaseBusiness,
  FileText,
  Vote,
  BarChart3,
  ShieldCheck,
  RefreshCcw,
  Upload,
  X
} from "lucide-react";

import { NavLink } from "react-router-dom";


function Sidebar({ isOpen, closeSidebar }) {

  const menuItems = [

    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard
    },

    {
      name: "Portfolio",
      path: "/admin/portfolio",
      icon: BriefcaseBusiness
    },

    {
      name: "Corporate Actions",
      path: "/admin/corporate-actions",
      icon: FileText
    },

    {
      name: "Elections",
      path: "/admin/elections",
      icon: Vote
    },

    {
      name: "Reports",
      path: "/admin/reports",
      icon: BarChart3
    },

    {
      name: "Audits & Controls",
      path: "/admin/audits-controls",
      icon: ShieldCheck
    },

    {
      name: "Reconciliation",
      path: "/admin/reconciliation",
      icon: RefreshCcw
    },

    {
      name: "Import Dataset",
      path: "/admin/import-dataset",
      icon: Upload
    }

  ];


  return (
    <>
      {/* Dark overlay */}

      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeSidebar}
        ></div>
      )}


      <aside
        className={`sidebar ${
          isOpen ? "sidebar-open" : ""
        }`}
      >

        {/* Sidebar Header */}

        <div className="sidebar-logo">

          <div className="logo-box">
            CA
          </div>


          <div>

            <h2>Corporate</h2>

            <span>
              Actions Hub
            </span>

          </div>


          <button
            className="sidebar-close"
            onClick={closeSidebar}
          >
            <X size={21} />
          </button>

        </div>


        {/* Navigation */}

        <nav className="sidebar-nav">

          {menuItems.map((item) => {

            const Icon = item.icon;

            return (

              <NavLink
                key={item.name}
                to={item.path}

                onClick={closeSidebar}

                className={({ isActive }) =>
                  isActive
                    ? "nav-item active"
                    : "nav-item"
                }
              >

                <Icon size={19} />

                <span>
                  {item.name}
                </span>

              </NavLink>

            );

          })}

        </nav>


        {/* Sidebar Footer */}

        <div className="sidebar-footer">

          <div className="admin-avatar">
            A
          </div>


          <div>

            <strong>
              Admin
            </strong>

            <small>
              Administrator
            </small>

          </div>

        </div>

      </aside>
    </>
  );
}

export default Sidebar;