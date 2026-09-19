import { useState } from "react";
import {
  UserCircle,
  Mail,
  Phone,
  ShieldCheck,
  Save,
  Pencil
} from "lucide-react";

function AdminProfile() {

  const [profile, setProfile] = useState({
    name: "Admin",
    email: "admin@corporateactions.com",
    phone: "+91 98765 43210",
    role: "Administrator",
  });

  const [editing, setEditing] = useState(false);

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value,
    });
  };

  const handleSave = () => {
    setEditing(false);

    // Later:
    // Send profile data to backend API
    console.log("Profile saved:", profile);
  };

  return (
    <div className="profile-page">

      {/* PAGE HEADER */}

      <div className="page-heading">

        <div>
          <h2>My Profile</h2>
          <p>
            View and manage your administrator profile.
          </p>
        </div>

      </div>


      {/* PROFILE CARD */}

      <div className="profile-container">

        {/* PROFILE HEADER */}

        <div className="profile-header">

          <div className="profile-avatar-large">
            {profile.name.charAt(0).toUpperCase()}
          </div>

          <div className="profile-header-info">

            <h3>{profile.name}</h3>

            <p>{profile.role}</p>

            <span className="profile-status">
              ● Active
            </span>

          </div>

        </div>


        {/* PERSONAL INFORMATION */}

        <div className="profile-section">

          <div className="profile-section-header">

            <div>
              <h3>Personal Information</h3>

              <p>
                Update your account information.
              </p>
            </div>

            {!editing && (
              <button
                className="edit-profile-button"
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} />
                Edit Profile
              </button>
            )}

          </div>


          <div className="profile-form">

            {/* NAME */}

            <div className="form-group">

              <label>
                Full Name
              </label>

              <div className="input-with-icon">

                <UserCircle size={18} />

                <input
                  type="text"
                  name="name"
                  value={profile.name}
                  onChange={handleChange}
                  disabled={!editing}
                />

              </div>

            </div>


            {/* EMAIL */}

            <div className="form-group">

              <label>
                Email Address
              </label>

              <div className="input-with-icon">

                <Mail size={18} />

                <input
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  disabled={!editing}
                />

              </div>

            </div>


            {/* PHONE */}

            <div className="form-group">

              <label>
                Phone Number
              </label>

              <div className="input-with-icon">

                <Phone size={18} />

                <input
                  type="text"
                  name="phone"
                  value={profile.phone}
                  onChange={handleChange}
                  disabled={!editing}
                />

              </div>

            </div>


            {/* ROLE */}

            <div className="form-group">

              <label>
                Role
              </label>

              <div className="input-with-icon">

                <ShieldCheck size={18} />

                <input
                  type="text"
                  value={profile.role}
                  disabled
                />

              </div>

            </div>

          </div>


          {/* SAVE / CANCEL */}

          {editing && (

            <div className="profile-actions">

              <button
                className="cancel-button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>

              <button
                className="save-profile-button"
                onClick={handleSave}
              >
                <Save size={17} />
                Save Changes
              </button>

            </div>

          )}

        </div>


        {/* ACCOUNT INFORMATION */}

        <div className="profile-section account-info">

          <h3>Account Information</h3>

          <div className="account-row">

            <span>Account Type</span>

            <strong>Administrator</strong>

          </div>

          <div className="account-row">

            <span>Account Status</span>

            <strong className="active-text">
              Active
            </strong>

          </div>

          <div className="account-row">

            <span>Last Login</span>

            <strong>
              Today, 10:32 AM
            </strong>

          </div>

        </div>

      </div>

    </div>
  );
}

export default AdminProfile;