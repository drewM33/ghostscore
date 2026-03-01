import {
  getReputationRegistry,
  getAgentIdentityRegistry,
  getValidationRegistry,
  getContractAddresses,
  safeContractCall,
} from './contracts.js';

export interface AgentScore {
  score: number;
  tier: number;
  totalPayments: number;
  lastPaymentTimestamp: number;
}

export interface AgentProfile {
  registered: boolean;
  metadataURI: string;
  registeredAt: number;
}

export interface ComplianceData {
  nullifierHashes: string[];
  paymentCount: number;
}

export interface ValidationStats {
  successes: number;
  total: number;
  rate: number;
}

export async function registerAgent(agentAddress: string): Promise<string> {
  const registry = getAgentIdentityRegistry();
  const tx = await safeContractCall('registerAgent', () =>
    registry.registerAgent(agentAddress),
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function updateAgentMetadata(agentAddress: string, metadataURI: string): Promise<string> {
  const registry = getAgentIdentityRegistry();
  const tx = await safeContractCall('updateMetadata', () =>
    registry.updateMetadata(agentAddress, metadataURI),
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function getAgentProfile(agentAddress: string): Promise<AgentProfile> {
  const registry = getAgentIdentityRegistry();
  const [registered, metadataURI, registeredAt] = await safeContractCall('getAgent', () =>
    registry.getAgent(agentAddress),
  );
  return {
    registered,
    metadataURI,
    registeredAt: Number(registeredAt),
  };
}

export async function getAgentScore(agentAddress: string): Promise<AgentScore> {
  const registry = getReputationRegistry();
  const [score, tier, totalPayments, lastPaymentTimestamp] = await safeContractCall('getScore', () =>
    registry.getScore(agentAddress),
  );
  return {
    score: Number(score),
    tier: Number(tier),
    totalPayments: Number(totalPayments),
    lastPaymentTimestamp: Number(lastPaymentTimestamp),
  };
}

export async function getAgentTier(agentAddress: string): Promise<number> {
  const registry = getReputationRegistry();
  return Number(await safeContractCall('getTier', () => registry.getTier(agentAddress)));
}

export async function submitFeedback(
  agentAddress: string,
  nullifierHash: string,
  paymentWeight: bigint,
  apiId: number,
): Promise<string> {
  const registry = getReputationRegistry();
  const tx = await safeContractCall('submitFeedback', () =>
    registry.submitFeedback(agentAddress, nullifierHash, paymentWeight, apiId),
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function submitValidation(
  agentAddress: string,
  actionHash: string,
  success: boolean,
): Promise<string> {
  const registry = getValidationRegistry();
  const tx = await safeContractCall('submitValidation', () =>
    registry.submitValidation(agentAddress, actionHash, success),
  );
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function getFeedbackHistory(agentAddress: string): Promise<string[]> {
  const registry = getReputationRegistry();
  const hashes: string[] = await safeContractCall('getFeedbackHistory', () =>
    registry.getFeedbackHistory(agentAddress),
  );
  return hashes;
}

export async function getComplianceData(agentAddress: string): Promise<ComplianceData> {
  const [nullifierHashes, scoreData] = await Promise.all([
    getFeedbackHistory(agentAddress),
    getAgentScore(agentAddress),
  ]);
  return {
    nullifierHashes,
    paymentCount: scoreData.totalPayments,
  };
}

export async function getValidationStats(agentAddress: string): Promise<ValidationStats> {
  const registry = getValidationRegistry();
  const [successes, total] = await safeContractCall('getValidationRate', () =>
    registry.getValidationRate(agentAddress),
  );
  const s = Number(successes);
  const t = Number(total);
  return {
    successes: s,
    total: t,
    rate: t > 0 ? s / t : 0,
  };
}

export async function discoverAgents(minTier: number): Promise<string[]> {
  const identityRegistry = getAgentIdentityRegistry();
  const addresses = getContractAddresses();
  return safeContractCall('discoverAgents', () =>
    identityRegistry.discoverAgents(minTier, addresses.ReputationRegistry),
  );
}
