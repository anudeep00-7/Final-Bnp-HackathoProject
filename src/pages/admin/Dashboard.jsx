import {
  BriefcaseBusiness,
  Clock3,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

function Dashboard() {
  return (
    <div>

      <div className="page-heading">
        <div>
          <h2>Dashboard</h2>
          <p>Overview of your corporate action operations.</p>
        </div>
      </div>


      <div className="stats-grid">

        <div className="stat-card">
          <div className="stat-icon">
            <BriefcaseBusiness />
          </div>

          <div>
            <span>Total Portfolios</span>
            <h3>24</h3>
          </div>
        </div>


        <div className="stat-card">
          <div className="stat-icon">
            <Clock3 />
          </div>

          <div>
            <span>Pending Actions</span>
            <h3>8</h3>
          </div>
        </div>


        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle2 />
          </div>

          <div>
            <span>Processed</span>
            <h3>18</h3>
          </div>
        </div>


        <div className="stat-card">
          <div className="stat-icon">
            <AlertTriangle />
          </div>

          <div>
            <span>Exceptions</span>
            <h3>2</h3>
          </div>
        </div>

      </div>


      <div className="dashboard-grid">

        <div className="panel">

          <div className="panel-header">
            <div>
              <h3>New Corporate Actions</h3>
              <p>Recently received announcements</p>
            </div>

            <button className="text-button">
              View All
            </button>
          </div>


          <div className="action-list">

            <div className="action-row">
              <div>
                <strong>ABC Technologies</strong>
                <span>Cash Dividend</span>
              </div>

              <span className="status pending">
                NEW
              </span>
            </div>


            <div className="action-row">
              <div>
                <strong>XYZ Industries</strong>
                <span>Bonus Issue</span>
              </div>

              <span className="status pending">
                NEW
              </span>
            </div>


            <div className="action-row">
              <div>
                <strong>PQR Limited</strong>
                <span>Name Change</span>
              </div>

              <span className="status processed">
                PROCESSED
              </span>
            </div>

          </div>

        </div>


        <div className="panel">

          <div className="panel-header">
            <div>
              <h3>Processing Summary</h3>
              <p>Current action status</p>
            </div>
          </div>


          <div className="summary-item">
            <span>New</span>
            <strong>4</strong>
          </div>

          <div className="summary-item">
            <span>Pending</span>
            <strong>4</strong>
          </div>

          <div className="summary-item">
            <span>Processed</span>
            <strong>18</strong>
          </div>

          <div className="summary-item">
            <span>Failed</span>
            <strong>2</strong>
          </div>

        </div>

      </div>

    </div>
  );
}

export default Dashboard;