import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import { getAPIGatekeeper, safeContractCall } from '../services/contracts.js';
import { handleUnexpected } from '../utils/errors.js';

const router = Router();

interface ProviderRecord {
  apiKeyHash: string;
  address: string;
  createdAt: number;
}

const providers = new Map<string, ProviderRecord>();

function hashApiKey(key: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(key));
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { address } = req.body as { address?: string };
    if (!address || !ethers.isAddress(address)) {
      res.status(400).json({ error: true, code: 'INVALID_ADDRESS', message: 'Valid address required' });
      return;
    }

    const apiKey = `gs_${uuidv4().replace(/-/g, '')}`;
    const keyHash = hashApiKey(apiKey);

    providers.set(keyHash, {
      apiKeyHash: keyHash,
      address,
      createdAt: Date.now(),
    });

    res.status(201).json({
      success: true,
      apiKey,
      address,
      message: 'Provider registered. Store your API key — it cannot be recovered.',
    });
  } catch (err) {
    handleUnexpected(res, err, 'provider/register');
  }
});

export function authenticateProvider(apiKey: string): ProviderRecord | null {
  const keyHash = hashApiKey(apiKey);
  return providers.get(keyHash) ?? null;
}

const API_NAME_TO_PATH: Record<string, string> = {
  'Market Data': '/api/market-data',
  'Agent Discovery (ERC-8004)': '/api/agents/discover',
  'Agent Coordination': '/api/agents/coordinate',
  'Shielded Transfer Relay': '/api/shielded-relay',
  'ZK Identity Attestation': '/api/zk-attestation',
};

router.get('/apis', async (req: Request, res: Response) => {
  try {
    const gatekeeper = getAPIGatekeeper();

    const nextApiId = await safeContractCall('nextApiId', () =>
      gatekeeper.nextApiId(),
    );

    const apis = [];
    for (let i = 0; i < Number(nextApiId); i++) {
      try {
        const [name, requiredTier, pricePerCall, provider, totalCalls, totalRevenue, active] =
          await safeContractCall('getAPI', () => gatekeeper.getAPI(i));

        const path = API_NAME_TO_PATH[name] ?? null;

        const priceStr = ethers.formatUnits(pricePerCall, 6);
        const priceNum = parseFloat(priceStr);
        const isUninitialized =
          !name || name.trim() === '' || Number(requiredTier) === 0 || priceNum === 0;
        if (isUninitialized) continue;

        apis.push({
          apiId: i,
          name,
          requiredTier: Number(requiredTier),
          pricePerCall: priceStr,
          provider,
          totalCalls: Number(totalCalls),
          totalRevenue: ethers.formatUnits(totalRevenue, 6),
          active,
          path,
        });
      } catch {
        // skip invalid API IDs
      }
    }

    res.json({ count: apis.length, apis });
  } catch (err) {
    handleUnexpected(res, err, 'provider/apis');
  }
});

export default router;
