const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

let onUnauthorizedCallback = null;

export const setOnUnauthorized = (cb) => {
  onUnauthorizedCallback = cb;
};

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem("actiledger_token");
  const user = localStorage.getItem("ca_user") || localStorage.getItem("bnp_user");
  let userId = "DEMO_ADMIN";
  try {
    if (user) {
      const parsed = JSON.parse(user);
      userId = parsed.role === "analyst" ? "DEMO_ANALYST" : "DEMO_ADMIN";
    }
  } catch (e) {
    // fallback
  }

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (userId) {
    headers["X-User-Id"] = userId;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, config);

  if (response.status === 401) {
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    throw new Error("Unauthorized. Please log in again.");
  }

  if (!response.ok) {
    let errorDetail = `HTTP Error ${response.status}`;
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function requestBlob(endpoint, options = {}) {
  const token = localStorage.getItem("actiledger_token");
  const user = localStorage.getItem("ca_user") || localStorage.getItem("bnp_user");
  let userId = "DEMO_ADMIN";
  try {
    if (user) {
      const parsed = JSON.parse(user);
      userId = parsed.role === "analyst" ? "DEMO_ANALYST" : "DEMO_ADMIN";
    }
  } catch (e) {}

  const headers = {
    ...options.headers,
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (userId) headers["X-User-Id"] = userId;

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}`);
  }

  return response.blob();
}

export const api = {
  auth: {
    login: (userId) => request("/login", { method: "POST", body: JSON.stringify({ user_id: userId }) }),
    me: () => request("/me"),
  },
  portfolios: {
    getAll: () => request("/portfolios"),
    getDetail: (id) => request(`/portfolios/${id}`),
    getHoldings: (id) => request(`/holdings/${id}`),
    getCash: (id) => request(`/cash/${id}`),
  },
  actions: {
    getAll: () => request("/actions"),
    getDetail: (caId) => request(`/actions/${caId}`),
    process: (caId) => request("/process-action", { method: "POST", body: JSON.stringify({ action_id: caId }) }),
    reverse: (caId, reason = "Reversal requested by operations admin") =>
      request("/reverse-action", { method: "POST", body: JSON.stringify({ action_id: caId, reason }) }),
    reject: (caId) => request("/reject-action", { method: "POST", body: JSON.stringify({ action_id: caId }) }),
    reviewTerms: (caId, processingBlockReason, policy = {}, notes = "") =>
      request(`/event-terms/${caId}`, {
        method: "PATCH",
        body: JSON.stringify({
          processing_block_reason: processingBlockReason,
          policy,
          notes,
        }),
      }),
  },
  elections: {
    getAll: (caId, portfolioId) => {
      const params = new URLSearchParams();
      if (caId) params.append("ca_id", caId);
      if (portfolioId) params.append("portfolio_id", portfolioId);
      const query = params.toString() ? `?${params.toString()}` : "";
      return request(`/elections${query}`);
    },
    create: (electionData) =>
      request("/elections", {
        method: "POST",
        body: JSON.stringify(electionData),
      }),
  },
  reconciliation: {
    getAll: (caId, portfolioId, processingId, limit = 100) => {
      const params = new URLSearchParams();
      if (caId) params.append("ca_id", caId);
      if (portfolioId) params.append("portfolio_id", portfolioId);
      if (processingId) params.append("processing_id", processingId);
      if (limit) params.append("limit", limit);
      const query = params.toString() ? `?${params.toString()}` : "";
      return request(`/reconciliation${query}`);
    },
    resolve: (processingId) => request(`/reconciliation/${processingId}/resolve`, { method: "POST" }),
  },
  dataset: {
    import: (data) => request("/import-dataset", { method: "POST", body: JSON.stringify(data) }),
  },
  audit: {
    getAll: (actionId, portfolioId) => {
      const params = new URLSearchParams();
      if (actionId) params.append("action_id", actionId);
      if (portfolioId) params.append("portfolio_id", portfolioId);
      const query = params.toString() ? `?${params.toString()}` : "";
      return request(`/audit${query}`);
    },
    ask: (question) => request("/audit/ask", { method: "POST", body: JSON.stringify({ question }) }),
  },
  settlements: {
    getAll: (portfolioId, limit = 200) => {
      const params = new URLSearchParams();
      if (portfolioId) params.append("portfolio_id", portfolioId);
      if (limit) params.append("limit", limit);
      const query = params.toString() ? `?${params.toString()}` : "";
      return request(`/settlements${query}`);
    },
  },
  reports: {
    getSummary: (portfolioId) => request(`/reports/${portfolioId}/summary`),
    getPdfBlob: (portfolioId) => requestBlob(`/reports/${portfolioId}/pdf`),
    extractNotice: (text) => request("/reports/extract-notice", { method: "POST", body: JSON.stringify({ text }) }),
  },
};
