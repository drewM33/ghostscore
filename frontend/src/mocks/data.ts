import type {
  AgentScore,
  AgentProfile,
  APIInfo,
  DiscoveredAgent,
  NullifierEntry,
  GhostEvent,
  GovernanceStatus,
  ValidationStats,
} from "../types";

export const MOCK_AGENT_SCORE: AgentScore = {
  score: 35,
  tier: 1,
  totalPayments: 7,
  lastPaymentTimestamp: Date.now() / 1000 - 120,
};

export const MOCK_APIS: APIInfo[] = [
  {
    apiId: 0,
    name: "Market Data",
    requiredTier: 1,
    pricePerCall: "0.001",
    totalCalls: 142,
    totalRevenue: "0.142",
  },
  {
    apiId: 1,
    name: "Agent Discovery (ERC-8004)",
    requiredTier: 2,
    pricePerCall: "0.005",
    totalCalls: 38,
    totalRevenue: "0.190",
  },
  {
    apiId: 2,
    name: "Agent Coordination",
    requiredTier: 3,
    pricePerCall: "0.01",
    totalCalls: 5,
    totalRevenue: "0.050",
  },
  {
    apiId: 3,
    name: "Shielded Transfer Relay",
    requiredTier: 1,
    pricePerCall: "0.002",
    totalCalls: 0,
    totalRevenue: "0",
  },
  {
    apiId: 4,
    name: "ZK Identity Attestation",
    requiredTier: 2,
    pricePerCall: "0.008",
    totalCalls: 0,
    totalRevenue: "0",
  },
];

const mockHash = (i: number) =>
  `0x${i.toString(16).padStart(4, "0")}${"a".repeat(60)}`;

export const MOCK_NULLIFIERS: NullifierEntry[] = Array.from(
  { length: 7 },
  (_, i) => ({
    hash: mockHash(i + 1),
    timestamp: Date.now() / 1000 - (7 - i) * 600,
  })
);

export const MOCK_EVENTS: GhostEvent[] = [
  {
    id: "evt-1",
    type: "payment:made",
    timestamp: Date.now() - 5000,
    data: { amount: "0.001", nullifier: mockHash(7) },
  },
  {
    id: "evt-2",
    type: "score:updated",
    timestamp: Date.now() - 4800,
    data: { agent: "0xAgent1", newScore: 35, newTier: 1 },
  },
  {
    id: "evt-3",
    type: "tier:changed",
    timestamp: Date.now() - 30000,
    data: { agent: "0xAgent1", oldTier: 0, newTier: 1 },
  },
  {
    id: "evt-4",
    type: "api:called",
    timestamp: Date.now() - 60000,
    data: { agent: "0xAgent1", apiId: 1, apiName: "Market Data" },
  },
];

export const MOCK_GOVERNANCE: GovernanceStatus = {
  oracle: "0x8dC3ac499099C62FD20dB1f67b0b695EE2712c7B",
  signers: [
    "0xSigner1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "0xSigner2bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    "0xSigner3ccccccccccccccccccccccccccccccccc",
  ],
  proposals: [],
  paused: false,
};

export const MOCK_VALIDATION_STATS: ValidationStats = {
  totalValidations: 180,
  successRate: 0.972,
};

export const MOCK_MARKET_DATA = {
  prices: {
    bitcoin: { usd: 97_245.32, usd_24h_change: 2.14 },
    ethereum: { usd: 3_412.87, usd_24h_change: -0.83 },
    monad: { usd: 1.24, usd_24h_change: 12.5 },
  },
  timestamp: Date.now(),
};

export const MOCK_AGENT_PROFILE: AgentProfile = {
  name: "Agent Alpha",
  description: "Autonomous trading agent",
  capabilities: ["market-data", "payments"],
};

export const MOCK_DISCOVERED_AGENTS: DiscoveredAgent[] = [
  {
    address: "0xAgent2ddddddddddddddddddddddddddddd",
    score: 62,
    tier: 2,
    metadataURI: "ipfs://QmMock2",
    profile: {
      name: "Agent Beta",
      description: "DeFi arbitrage specialist",
      capabilities: ["market-data", "swaps", "analytics"],
    },
  },
  {
    address: "0xAgent3eeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    score: 88,
    tier: 3,
    metadataURI: "ipfs://QmMock3",
    profile: {
      name: "Agent Gamma",
      description: "Multi-chain coordinator",
      capabilities: ["payments", "coordination", "bridging"],
    },
  },
];
