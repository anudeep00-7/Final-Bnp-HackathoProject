function Portfolio() {
  const portfolios = [
    {
      id: "P001",
      name: "Growth Fund",
      cash: "₹50,000",
      securities: "₹4,20,000",
      value: "₹4,70,000",
    },
    {
      id: "P002",
      name: "Income Fund",
      cash: "₹30,000",
      securities: "₹2,10,000",
      value: "₹2,40,000",
    },
    {
      id: "P003",
      name: "Balanced Fund",
      cash: "₹40,000",
      securities: "₹3,10,000",
      value: "₹3,50,000",
    },
  ];

  return (
    <div>

      <div className="page-heading">
        <div>
          <h2>Portfolio</h2>
          <p>View all portfolios and their current positions.</p>
        </div>
      </div>

      <div className="panel">

        <div className="panel-header">
          <h3>All Portfolios</h3>

          <input
            className="search-input"
            placeholder="Search portfolio..."
          />
        </div>

        <div className="table-wrapper">

          <table>

            <thead>
              <tr>
                <th>Portfolio ID</th>
                <th>Portfolio Name</th>
                <th>Cash Balance</th>
                <th>Security Value</th>
                <th>Total Value</th>
              </tr>
            </thead>

            <tbody>

              {portfolios.map((portfolio) => (
                <tr key={portfolio.id}>

                  <td>
                    <strong>{portfolio.id}</strong>
                  </td>

                  <td>{portfolio.name}</td>

                  <td>{portfolio.cash}</td>

                  <td>{portfolio.securities}</td>

                  <td>
                    <strong>{portfolio.value}</strong>
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

export default Portfolio;