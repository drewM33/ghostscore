import type {
  AgentScore,
  AgentProfile,
  APIInfo,
  DiscoveredAgent,
  NullifierEntry,
  GovernanceStatus,
  ValidationStats,
} from "../types";
import {
  MOCK_AGENT_SCORE,
  MOCK_AGENT_PROFILE,
  MOCK_APIS,
  MOCK_DISCOVERED_AGENTS,
  MOCK_NULLIFIERS,
  MOCK_GOVERNANCE,
  MOCK_VALIDATION_STATS,
} from "../mocks/data";

const BASE = "";

export interface APIError {
  status: number;
  code?: string;
  message?: string;
  headers?: Record<string, string>;
}

const DEFAULT_TIMEOUT_MS = 3_000;
const SLOW_TIMEOUT_MS = 60_000;

let _agentAddress = "";

async function request<T>(
  path: string,
  opts?: RequestInit & { mockFallback?: T; timeoutMs?: number }
): Promise<T> {
  let res: Response;
  try {
    const controller = new AbortController();
    const ms = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => controller.abort(), ms);
    const { mockFallback: _, timeoutMs: _t, ...fetchOpts } = opts ?? {};
    res = await fetch(`${BASE}${path}`, {
      ...fetchOpts,
      headers: {
        "Content-Type": "application/json",
        ...(_agentAddress && { "X-Agent-Address": _agentAddress }),
        ...opts?.headers,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    console.error(`[api] ${path} fetch failed:`, err);
    if (opts?.mockFallback !== undefined) {
      console.warn(`[api] ${path} unreachable, using mock data`);
      return opts.mockFallback;
    }
    throw { status: 0, code: "NETWORK_ERROR", message: "Backend unreachable" } as APIError;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: APIError = { status: res.status, ...body };
    console.error(`[api] ${path} → ${res.status}:`, body);

    if (res.status === 402) {
      const d = body.details as Record<string, string> | undefined;
      err.headers = {
        "X-Payment-Amount": d?.price || res.headers.get("x-price") || "",
        "X-Payment-Token": d?.token || res.headers.get("x-token") || "",
        "X-Payment-Recipient": d?.recipient || res.headers.get("x-recipient") || "",
      };
    }

    if (opts?.mockFallback !== undefined && res.status >= 500) {
      console.warn(`[api] ${path} → ${res.status}, using mock data`);
      return opts.mockFallback;
    }

    throw err;
  }

  return (await res.json()) as T;
}

export const api = {
  setAgentAddress(address: string) {
    _agentAddress = address;
  },

  getScore(address: string) {
    return request<AgentScore>(`/agent/score/${address}`, {
      mockFallback: MOCK_AGENT_SCORE,
    });
  },

  registerAgent(
    address: string,
    metadata?: { name: string; description: string; capabilities: string[] }
  ) {
    return request<{ success: boolean; profile?: AgentProfile }>("/agent/register", {
      method: "POST",
      body: JSON.stringify({ address, ...metadata }),
      timeoutMs: SLOW_TIMEOUT_MS,
    });
  },

  getAgentProfile(address: string) {
    return request<AgentProfile>(`/agent/profile/${address}`, {
      mockFallback: MOCK_AGENT_PROFILE,
    });
  },

  getNullifiers(address: string) {
    return request<NullifierEntry[]>(`/agent/compliance/${address}`, {
      mockFallback: MOCK_NULLIFIERS,
    });
  },

  async getProviderAPIs() {
    const data = await request<{ count: number; apis: APIInfo[] } | APIInfo[]>(
      "/provider/apis",
      { mockFallback: MOCK_APIS }
    );
    return Array.isArray(data) ? data : data.apis;
  },

  callShieldedRelay(address: string, to: string, amount: string, paid = false) {
    return request<Record<string, unknown>>(
      `/api/shielded-relay?to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`,
      {
        headers: {
          "X-Agent-Address": address,
          ...(paid && { "X-Payment": "true" }),
        },
        timeoutMs: paid ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      }
    );
  },

  callZkAttestation(address: string, agent: string, threshold: number, paid = false) {
    return request<Record<string, unknown>>(
      `/api/zk-attestation?agent=${encodeURIComponent(agent)}&threshold=${encodeURIComponent(threshold)}`,
      {
        headers: {
          "X-Agent-Address": address,
          ...(paid && { "X-Payment": "true" }),
        },
        timeoutMs: paid ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      }
    );
  },

  makePayment(address: string) {
    return request<{
      success: boolean;
      nullifierHash: string;
      txHash: string;
      newScore: number;
      newTier: number;
      tierLabel: string;
      amount: string;
    }>("/pay", {
      method: "POST",
      body: JSON.stringify({ agentAddress: address }),
      headers: { "X-Agent-Address": address },
      timeoutMs: SLOW_TIMEOUT_MS,
    });
  },

  callMarketData(address: string, paid = false) {
    return request<Record<string, unknown>>("/api/market-data", {
      headers: {
        "X-Agent-Address": address,
        ...(paid && { "X-Payment": "true" }),
      },
      timeoutMs: paid ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
    });
  },

  callAgentDiscovery(address: string, minTier = 1, paid = false) {
    return request<DiscoveredAgent[]>(`/agents/discover?minTier=${minTier}`, {
      headers: {
        "X-Agent-Address": address,
        ...(paid && { "X-Payment": "true" }),
      },
      mockFallback: MOCK_DISCOVERED_AGENTS,
      timeoutMs: paid ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
    });
  },

  callAgentCoordination(
    address: string,
    recipient: string,
    amount: string,
    memo: string,
    paid = false
  ) {
    return request<{ success: boolean; txHash: string }>(
      "/api/agents/coordinate",
      {
        method: "POST",
        body: JSON.stringify({ recipientAgent: recipient, amount, memo }),
        headers: {
          "X-Agent-Address": address,
          ...(paid && { "X-Payment": "true" }),
        },
        timeoutMs: paid ? SLOW_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      }
    );
  },

  getGovernance() {
    return request<GovernanceStatus>("/governance/status", {
      mockFallback: MOCK_GOVERNANCE,
    });
  },

  getValidationStats() {
    return request<ValidationStats>("/provider/validations", {
      mockFallback: MOCK_VALIDATION_STATS,
    });
  },

  getServerWallet() {
    return request<{ address: string; unlinkAddress: string }>(
      "/agent/wallet",
      { mockFallback: { address: "0x0000000000000000000000000000000000000000", unlinkAddress: "" } }
    );
  },

  callEndpoint(path: string) {
    return request<unknown>(path);
  },
};
