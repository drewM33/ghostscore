export interface AgentScore {
  score: number;
  tier: TierLevel;
  totalPayments: number;
  lastPaymentTimestamp: number;
}

export type TierLevel = 0 | 1 | 2 | 3;

export const TIER_META: Record<
  TierLevel,
  { label: string; color: string; bgColor: string; minScore: number }
> = {
  0: {
    label: "Unverified",
    color: "text-gray-400",
    bgColor: "bg-gray-700",
    minScore: 0,
  },
  1: {
    label: "Basic",
    color: "text-emerald-400",
    bgColor: "bg-emerald-900/50",
    minScore: 20,
  },
  2: {
    label: "Verified",
    color: "text-blue-400",
    bgColor: "bg-blue-900/50",
    minScore: 50,
  },
  3: {
    label: "Trusted",
    color: "text-amber-400",
    bgColor: "bg-amber-900/50",
    minScore: 80,
  },
};

export interface APIInfo {
  apiId: number;
  name: string;
  requiredTier: TierLevel;
  pricePerCall: string;
  totalCalls: number;
  totalRevenue: string;
  path?: string | null;
}

export interface NullifierEntry {
  hash: string;
  timestamp: number;
}

export interface GhostEvent {
  id: string;
  type:
    | "score:updated"
    | "tier:changed"
    | "api:called"
    | "validation:new"
    | "payment:made";
  timestamp: number;
  data: Record<string, unknown>;
}

export interface GovernanceStatus {
  oracle: string;
  signers: string[];
  proposals: GovernanceProposal[];
  paused: boolean;
}

export interface GovernanceProposal {
  id: number;
  newOracle: string;
  createdAt: number;
  approvalCount: number;
  executed: boolean;
}

export interface ValidationStats {
  totalValidations: number;
  successRate: number;
}

export interface AgentProfile {
  name: string;
  description: string;
  capabilities: string[];
  avatar?: string;
  metadataURI?: string;
}

export interface DiscoveredAgent {
  address: string;
  score: number;
  tier: number;
  metadataURI: string;
  profile?: AgentProfile;
}

export interface ComplianceReport {
  generatedAt: string;
  totalPayments: number;
  nullifiers: NullifierEntry[];
  governance: GovernanceStatus;
  validations: ValidationStats;
}

export type TabId = "agent" | "provider" | "compliance" | "chat";
