import React, { useState } from "react";

const initialElections = [
  {
    id: "CA-2026-001",
    security: "ABC Ltd",
    type: "Rights Issue",
    recordDate: "25 Sep 2026",
    electionDate: "30 Sep 2026",
    eligible: 4,
    status: "Pending",
  },
  {
    id: "CA-2026-002",
    security: "XYZ Ltd",
    type: "Buyback",
    recordDate: "28 Sep 2026",
    electionDate: "02 Oct 2026",
    eligible: 3,
    status: "Accepted",
  },
  {
    id: "CA-2026-003",
    security: "PQR Ltd",
    type: "Merger",
    recordDate: "30 Sep 2026",
    electionDate: "05 Oct 2026",
    eligible: 2,
    status: "Paused",
  },
  {
    id: "CA-2026-004",
    security: "DEF Ltd",
    type: "Tender Offer",
    recordDate: "02 Oct 2026",
    electionDate: "08 Oct 2026",
    eligible: 3,
    status: "Rejected",
  },
];

/* Mock portfolio data */
const portfolioData = {
  "CA-2026-001": [
    {
      id: "PF-001",
      name: "Alpha Growth Portfolio",
      holding: 1000,
      entitlement: 250,
      election: "Pending",
      subscribed: 0,
    },
    {
      id: "PF-002",
      name: "Balanced Income Portfolio",
      holding: 600,
      entitlement: 150,
      election: "Pending",
      subscribed: 0,
    },
    {
      id: "PF-003",
      name: "Global Equity Portfolio",
      holding: 320,
      entitlement: 80,
      election: "Pending",
      subscribed: 0,
    },
    {
      id: "PF-004",
      name: "Growth Plus Portfolio",
      holding: 1200,
      entitlement: 300,
      election: "Pending",
      subscribed: 0,
    },
  ],

  "CA-2026-002": [
    {
      id: "PF-005",
      name: "Income Portfolio",
      holding: 500,
      entitlement: 100,
      election: "Pending",
      subscribed: 0,
    },
    {
      id: "PF-006",
      name: "Equity Portfolio",
      holding: 800,
      entitlement: 160,
      election: "Pending",
      subscribed: 0,
    },
    {
      id: "PF-007",
      name: "Conservative Portfolio",
      holding: 300,
      entitlement: 60,
      election: "Pending",
      subscribed: 0,
    },
  ],
};

function Elections() {
  const [elections, setElections] = useState(initialElections);

  const [selectedElection, setSelectedElection] = useState(null);

  const [selectedPortfolio, setSelectedPortfolio] = useState(null);

  const [filter, setFilter] = useState("All");

  const [portfolioStatus, setPortfolioStatus] = useState({});

  const [partialQuantity, setPartialQuantity] = useState("");

  const filteredElections =
    filter === "All"
      ? elections
      : elections.filter((item) => item.status === filter);

  /* Update corporate action status */
  const updateStatus = (id, status) => {
    setElections((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status }
          : item
      )
    );

    setSelectedElection((prev) =>
      prev
        ? { ...prev, status }
        : prev
    );
  };

  /* Open portfolio election */
  const openPortfolioElection = (portfolio) => {
    setSelectedPortfolio(portfolio);
    setPartialQuantity("");
  };

  /* Save portfolio election */
  const savePortfolioElection = (portfolioId, status, quantity) => {
    setPortfolioStatus((prev) => ({
      ...prev,
      [portfolioId]: {
        status,
        subscribed: quantity,
      },
    }));

    setSelectedPortfolio(null);
  };

  /* Get portfolio status */
  const getPortfolioStatus = (portfolio) => {
    return (
      portfolioStatus[portfolio.id]?.status ||
      portfolio.election
    );
  };

  return (
    <div className="elections-page">

      {/* ================= HEADER ================= */}

      <div className="elections-header">

        <div>
          <h1>Elections</h1>

          <p>
            Manage voluntary corporate action elections
            for eligible portfolios.
          </p>
        </div>

        <div className="event-summary">

          <span>{elections.length}</span>

          <small>Total Events</small>

        </div>

      </div>


      {/* ================= FILTERS ================= */}

      <div className="election-filters">

        {[
          "All",
          "Pending",
          "Accepted",
          "Rejected",
          "Paused",
        ].map((status) => (

          <button
            key={status}
            className={
              filter === status
                ? "filter active"
                : "filter"
            }
            onClick={() => setFilter(status)}
          >
            {status}
          </button>

        ))}

      </div>


      {/* ================= EVENT TABLE ================= */}

      <div className="elections-card">

        <div className="table-header">

          <h2>
            Voluntary Corporate Actions
          </h2>

          <span>
            {filteredElections.length} events
          </span>

        </div>


        <div className="table-container">

          <table>

            <thead>

              <tr>

                <th>Event ID</th>

                <th>Security</th>

                <th>Action Type</th>

                <th>Record Date</th>

                <th>Election Date</th>

                <th>Eligible Portfolios</th>

                <th>Status</th>

                <th>Action</th>

              </tr>

            </thead>


            <tbody>

              {filteredElections.map((event) => (

                <tr key={event.id}>

                  <td>
                    {event.id}
                  </td>

                  <td>
                    <strong>
                      {event.security}
                    </strong>
                  </td>

                  <td>
                    {event.type}
                  </td>

                  <td>
                    {event.recordDate}
                  </td>

                  <td>
                    {event.electionDate}
                  </td>

                  <td>
                    {event.eligible}
                  </td>

                  <td>

                    <span
                      className={`status ${event.status.toLowerCase()}`}
                    >
                      {event.status}
                    </span>

                  </td>

                  <td>

                    <button
                      className="view-button"
                      onClick={() =>
                        setSelectedElection(event)
                      }
                    >
                      View
                    </button>

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </div>


      {/* ================================================= */}
      {/* CORPORATE ACTION DETAILS MODAL */}
      {/* ================================================= */}

      {selectedElection && (

        <div className="modal-overlay">

          <div className="election-modal">

            <div className="modal-header">

              <div>

                <h2>
                  {selectedElection.security}
                </h2>

                <p>
                  {selectedElection.type}
                </p>

              </div>


              <button
                className="close-button"
                onClick={() =>
                  setSelectedElection(null)
                }
              >
                ×
              </button>

            </div>


            {/* EVENT DETAILS */}

            <div className="event-details">

              <div>

                <label>Event ID</label>

                <strong>
                  {selectedElection.id}
                </strong>

              </div>


              <div>

                <label>Security</label>

                <strong>
                  {selectedElection.security}
                </strong>

              </div>


              <div>

                <label>Action Type</label>

                <strong>
                  {selectedElection.type}
                </strong>

              </div>


              <div>

                <label>Record Date</label>

                <strong>
                  {selectedElection.recordDate}
                </strong>

              </div>


              <div>

                <label>Election Deadline</label>

                <strong>
                  {selectedElection.electionDate}
                </strong>

              </div>


              <div>

                <label>Eligible Portfolios</label>

                <strong>
                  {selectedElection.eligible}
                </strong>

              </div>

            </div>


            {/* EVENT STATUS */}

            <div className="current-status">

              Current Status:

              <span
                className={`status ${selectedElection.status.toLowerCase()}`}
              >
                {selectedElection.status}
              </span>

            </div>


            {/* ================= PORTFOLIOS ================= */}

            <div className="portfolio-election-section">

              <div className="portfolio-section-header">

                <div>

                  <h3>
                    Eligible Portfolios
                  </h3>

                  <p>
                    Select a portfolio to make an election.
                  </p>

                </div>

              </div>


              <div className="portfolio-table-container">

                <table>

                  <thead>

                    <tr>

                      <th>Portfolio</th>

                      <th>Holding</th>

                      <th>Entitlement</th>

                      <th>Election</th>

                      <th>Action</th>

                    </tr>

                  </thead>


                  <tbody>

                    {(
                      portfolioData[
                        selectedElection.id
                      ] || []
                    ).map((portfolio) => (

                      <tr key={portfolio.id}>

                        <td>

                          <strong>
                            {portfolio.id}
                          </strong>

                          <br />

                          <small>
                            {portfolio.name}
                          </small>

                        </td>


                        <td>
                          {portfolio.holding}
                        </td>


                        <td>
                          {portfolio.entitlement}
                        </td>


                        <td>

                          <span
                            className={`status ${getPortfolioStatus(
                              portfolio
                            ).toLowerCase()}`}
                          >
                            {getPortfolioStatus(
                              portfolio
                            )}
                          </span>

                        </td>


                        <td>

                          <button
                            className="view-button"
                            onClick={() =>
                              openPortfolioElection(
                                portfolio
                              )
                            }
                          >
                            Elect
                          </button>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>


            {/* EVENT LEVEL ACTIONS */}

            <div className="election-actions">

              <button
                className="accept-btn"
                onClick={() =>
                  updateStatus(
                    selectedElection.id,
                    "Accepted"
                  )
                }
              >
                ✓ Accept Event
              </button>


              <button
                className="reject-btn"
                onClick={() =>
                  updateStatus(
                    selectedElection.id,
                    "Rejected"
                  )
                }
              >
                ✕ Reject Event
              </button>


              <button
                className="pause-btn"
                onClick={() =>
                  updateStatus(
                    selectedElection.id,
                    "Paused"
                  )
                }
              >
                ⏸ Pause Event
              </button>

            </div>

          </div>

        </div>

      )}


      {/* ================================================= */}
      {/* PORTFOLIO ELECTION MODAL */}
      {/* ================================================= */}

      {selectedPortfolio && (

        <div className="modal-overlay">

          <div className="portfolio-modal">

            <div className="modal-header">

              <div>

                <h2>
                  {selectedPortfolio.id}
                </h2>

                <p>
                  {selectedPortfolio.name}
                </p>

              </div>


              <button
                className="close-button"
                onClick={() =>
                  setSelectedPortfolio(null)
                }
              >
                ×
              </button>

            </div>


            {/* PORTFOLIO INFORMATION */}

            <div className="portfolio-info-grid">

              <div>

                <label>Security</label>

                <strong>
                  {selectedElection.security}
                </strong>

              </div>


              <div>

                <label>Current Holding</label>

                <strong>
                  {selectedPortfolio.holding}
                </strong>

              </div>


              <div>

                <label>Entitlement</label>

                <strong>
                  {selectedPortfolio.entitlement}
                </strong>

              </div>


              <div>

                <label>Issue Price</label>

                <strong>
                  ₹80
                </strong>

              </div>

            </div>


            {/* ELECTION OPTIONS */}

            <h3 className="election-title">
              Choose Election
            </h3>


            <div className="portfolio-election-buttons">

              {/* FULL */}

              <button
                className="full-election"
                onClick={() =>
                  savePortfolioElection(
                    selectedPortfolio.id,
                    "Accepted",
                    selectedPortfolio.entitlement
                  )
                }
              >
                ✓ Fully Subscribe
              </button>


              {/* PARTIAL */}

              <div className="partial-election">

                <label>
                  Partial Subscription
                </label>

                <div className="partial-row">

                  <input
                    type="number"
                    min="0"
                    max={selectedPortfolio.entitlement}
                    value={partialQuantity}
                    onChange={(e) =>
                      setPartialQuantity(
                        e.target.value
                      )
                    }
                    placeholder="Enter quantity"
                  />


                  <button
                    className="partial-button"
                    onClick={() => {

                      const quantity =
                        Number(partialQuantity);

                      if (
                        quantity > 0 &&
                        quantity <
                          selectedPortfolio.entitlement
                      ) {

                        savePortfolioElection(
                          selectedPortfolio.id,
                          "Partial",
                          quantity
                        );

                      } else {

                        alert(
                          `Enter a quantity between 1 and ${selectedPortfolio.entitlement}`
                        );

                      }

                    }}
                  >
                    Subscribe
                  </button>

                </div>

              </div>


              {/* DECLINE */}

              <button
                className="decline-election"
                onClick={() =>
                  savePortfolioElection(
                    selectedPortfolio.id,
                    "Rejected",
                    0
                  )
                }
              >
                ✕ Decline
              </button>


              {/* PAUSE */}

              <button
                className="pause-election"
                onClick={() =>
                  savePortfolioElection(
                    selectedPortfolio.id,
                    "Paused",
                    0
                  )
                }
              >
                ⏸ Pause
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

export default Elections;