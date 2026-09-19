import {
  Menu,
  Moon,
  Bell,
  UserCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";


function Topbar({ toggleSidebar }) {
      const navigate = useNavigate();


  return (
    <header className="topbar">

      <div className="topbar-left">

        <button
          className="menu-button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={25} />
        </button>

        <div>
          <h1>Hello! Welcome Back, Admin</h1>
          <p>
            Manage corporate actions and portfolio operations.
          </p>
        </div>

      </div>


      <div className="topbar-actions">

        <button className="icon-button">
          <Moon size={20} />
        </button>


        <button className="icon-button notification">
          <Bell size={20} />

          <span className="notification-dot"></span>
        </button>


        <button className="profile-button">
  <UserCircle size={28} />
  <span>Admin</span>
</button>

      </div>

    </header>
  );
}

export default Topbar;