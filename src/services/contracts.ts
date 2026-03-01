import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function loadAddresses(): Record<string, string> {
  const raw = readFileSync(resolve(ROOT, 'deployed-addresses.json'), 'utf-8');
  return JSON.parse(raw);
}

function loadABI(contractDir: string, contractName: string): ethers.InterfaceAbi {
  const artifactPath = resolve(ROOT, 'artifacts', 'contracts', contractDir, `${contractName}.json`);
  const raw = readFileSync(artifactPath, 'utf-8');
  return JSON.parse(raw).abi;
}

const ADDRESSES = loadAddresses();

const ABIS = {
  AgentIdentityRegistry: loadABI('AgentIdentityRegistry.sol', 'AgentIdentityRegistry'),
  ReputationRegistry: loadABI('ReputationRegistry.sol', 'ReputationRegistry'),
  ValidationRegistry: loadABI('ValidationRegistry.sol', 'ValidationRegistry'),
  APIGatekeeper: loadABI('APIGatekeeper.sol', 'APIGatekeeper'),
  Governance: loadABI('Governance.sol', 'Governance'),
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('429') || msg.includes('-32007') || msg.includes('rate limit') || msg.includes('request limit')) {
    return true;
  }
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as any).error;
    if (inner?.code === -32007 || inner?.message?.includes('request limit')) return true;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function rpcRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt < MAX_RETRIES && isRateLimitError(err)) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        console.warn(`[RPC] ${label} hit rate limit (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`[RPC] ${label} exhausted ${MAX_RETRIES} retries`);
}

let provider: ethers.JsonRpcProvider;
let signer: ethers.Wallet;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.MONAD_RPC_URL;
    if (!rpcUrl) throw new Error('MONAD_RPC_URL not set');
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return provider;
}

export { sleep };

export function getSigner(): ethers.Wallet {
  if (!signer) {
    const key = process.env.DEPLOYER_PRIVATE_KEY;
    if (!key) throw new Error('DEPLOYER_PRIVATE_KEY not set');
    signer = new ethers.Wallet(key, getProvider());
  }
  return signer;
}

export function getSignerAddress(): string {
  return getSigner().address;
}

export function getAgentIdentityRegistry(): ethers.Contract {
  return new ethers.Contract(
    ADDRESSES.AgentIdentityRegistry,
    ABIS.AgentIdentityRegistry,
    getSigner(),
  );
}

export function getReputationRegistry(): ethers.Contract {
  return new ethers.Contract(
    ADDRESSES.ReputationRegistry,
    ABIS.ReputationRegistry,
    getSigner(),
  );
}

export function getValidationRegistry(): ethers.Contract {
  return new ethers.Contract(
    ADDRESSES.ValidationRegistry,
    ABIS.ValidationRegistry,
    getSigner(),
  );
}

export function getAPIGatekeeper(): ethers.Contract {
  return new ethers.Contract(
    ADDRESSES.APIGatekeeper,
    ABIS.APIGatekeeper,
    getSigner(),
  );
}

export function getGovernance(): ethers.Contract {
  return new ethers.Contract(
    ADDRESSES.Governance,
    ABIS.Governance,
    getSigner(),
  );
}

export function getContractAddresses() {
  return { ...ADDRESSES };
}

export async function checkRpcConnection(): Promise<boolean> {
  try {
    const p = getProvider();
    const blockNumber = await Promise.race([
      rpcRetry('checkRpc', () => p.getBlockNumber()),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 10_000)),
    ]);
    return blockNumber > 0;
  } catch (err) {
    console.error('[RPC] Connection check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

export async function checkContractDeployed(address: string): Promise<boolean> {
  try {
    const code = await rpcRetry('getCode', () => getProvider().getCode(address));
    return code !== '0x';
  } catch {
    return false;
  }
}

export async function safeContractCall<T>(
  method: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await rpcRetry(method, fn);
  } catch (err: unknown) {
    if (isRateLimitError(err)) {
      throw new (await import('../utils/errors.js')).ContractCallError(method, 'RPC rate limit exceeded after retries');
    }

    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('CALL_EXCEPTION') || msg.includes('revert')) {
      const revertMatch = msg.match(/reason="([^"]+)"/);
      const reason = revertMatch ? revertMatch[1] : 'unknown revert';
      throw new (await import('../utils/errors.js')).ContractCallError(method, reason);
    }

    if (msg.includes('INSUFFICIENT_FUNDS')) {
      throw new (await import('../utils/errors.js')).ContractCallError(method, 'insufficient funds for gas');
    }

    throw new (await import('../utils/errors.js')).ContractCallError(method, msg);
  }
}
