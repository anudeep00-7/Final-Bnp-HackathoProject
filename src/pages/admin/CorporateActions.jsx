function CorporateActions() {

  const actions = [
    {
      id: "CA001",
      security: "ABC Technologies",
      type: "Cash Dividend",
      date: "25 Sep 2026",
      status: "NEW",
    },
    {
      id: "CA002",
      security: "XYZ Industries",
      type: "Bonus Issue",
      date: "28 Sep 2026",
      status: "NEW",
    },
    {
      id: "CA003",
      security: "PQR Limited",
      type: "Name Change",
      date: "30 Sep 2026",
      status: "PROCESSED",
    },
  ];

  return (
    <div>

      <div className="page-heading">
        <div>
          <h2>Corporate Actions</h2>
          <p>Review and manage incoming corporate actions.</p>
        </div>
      </div>

      <div className="panel">

        <div className="filters">

          <input
            className="search-input"
            placeholder="Search action..."
          />

          <select>
            <option>All Types</option>
            <option>Cash Dividend</option>
            <option>Bonus Issue</option>
            <option>Name Change</option>
          </select>

          <select>
            <option>All Status</option>
            <option>New</option>
            <option>Processed</option>
            <option>Rejected</option>
          </select>

        </div>


        <div className="table-wrapper">

          <table>

            <thead>
              <tr>
                <th>Action ID</th>
                <th>Security</th>
                <th>Action Type</th>
                <th>Key Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>

              {actions.map((action) => (

                <tr key={action.id}>

                  <td>{action.id}</td>

                  <td>
                    <strong>{action.security}</strong>
                  </td>

                  <td>{action.type}</td>

                  <td>{action.date}</td>

                  <td>
                    <span
                      className={`status ${
                        action.status === "NEW"
                          ? "pending"
                          : "processed"
                      }`}
                    >
                      {action.status}
                    </span>
                  </td>

                  <td>
                    <button className="view-button">
                      View
                    </button>
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}

export default CorporateActions;