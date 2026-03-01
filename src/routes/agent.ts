import { Router, type Request, type Response } from 'express';
import { ethers } from 'ethers';
import {
  registerAgent,
  getAgentProfile,
  getAgentScore,
  getComplianceData,
  discoverAgents,
  submitFeedback,
  updateAgentMetadata,
} from '../services/reputation.js';
import { pinMetadataToIPFS, fetchMetadataFromIPFS, type AgentMetadata } from '../services/ipfs.js';
import { executeShieldedTransfer, getUnlinkAddress } from '../services/unlink.js';
import { getSignerAddress, sleep } from '../services/contracts.js';
import { InvalidAddressError, AgentNotFoundError, sendError, handleUnexpected } from '../utils/errors.js';
import { getSocketIO } from '../socket.js';

const payRateLimit = new Map<string, number[]>();
const PAY_MAX_PER_SEC = 2;

function checkPayRate(agent: string): boolean {
  const now = Date.now();
  const window = payRateLimit.get(agent) ?? [];
  const recent = window.filter((t) => now - t < 1_000);
  if (recent.length >= PAY_MAX_PER_SEC) return false;
  recent.push(now);
  payRateLimit.set(agent, recent);
  return true;
}

const router = Router();

function validateAddress(address: string, field: string): void {
  if (!ethers.isAddress(address)) throw new InvalidAddressError(field);
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { address, name, description, capabilities, avatar } = req.body as {
      address?: string;
      name?: string;
      description?: string;
      capabilities?: string[];
      avatar?: string;
    };
    if (!address) {
      res.status(400).json({ error: true, code: 'MISSING_FIELD', message: 'address is required' });
      return;
    }

    validateAddress(address, 'address');

    const existing = await getAgentProfile(address);
    if (existing.registered) {
      res.status(409).json({ error: true, code: 'ALREADY_REGISTERED', message: 'Agent already registered' });
      return;
    }

    const txHash = await registerAgent(address);

    let metadata: { cid: string; metadataURI: string } | undefined;
    if (name || description) {
      const agentMeta: AgentMetadata = {
        address,
        name: name ?? '',
        description: description ?? '',
        capabilities: capabilities ?? [],
        avatar,
        pinnedAt: new Date().toISOString(),
      };
      metadata = await pinMetadataToIPFS(agentMeta);
      await updateAgentMetadata(address, metadata.metadataURI);
    }

    res.status(201).json({
      success: true,
      agent: address,
      txHash,
      message: 'Agent registered on-chain',
      ...(metadata && { cid: metadata.cid, metadataURI: metadata.metadataURI }),
    });
  } catch (err) {
    if (err instanceof InvalidAddressError) return sendError(res, err);
    handleUnexpected(res, err, 'agent/register');
  }
});

/**
 * POST /pay — Reputation onramp.
 * Agents pay to build trust BEFORE they can access tier-gated APIs.
 * No tier check, no gating — this is the entry point into the system.
 * apiId=0 signals a raw reputation payment not tied to any specific API.
 */
router.post('/pay', async (req: Request, res: Response) => {
  try {
    const { agentAddress, amount } = req.body as { agentAddress?: string; amount?: string };
    if (!agentAddress) {
      res.status(400).json({ error: true, code: 'MISSING_FIELD', message: 'agentAddress is required' });
      return;
    }

    validateAddress(agentAddress, 'agentAddress');

    if (!checkPayRate(agentAddress)) {
      res.status(429).json({ error: true, code: 'RATE_LIMITED', message: 'Max 2 payments per second per agent' });
      return;
    }

    const payAmount = amount ?? '1.0';

    const { nullifierHash } = await executeShieldedTransfer(
      getSignerAddress(),
      payAmount,
      agentAddress,
    );

    await sleep(1_000);

    const paymentWeight = ethers.parseUnits(payAmount, 6);
    const txHash = await submitFeedback(agentAddress, nullifierHash, paymentWeight, 0);

    const updated = await getAgentScore(agentAddress);

    // Emit WebSocket events so Ghost Activity feed updates in real time
    const socketIo = getSocketIO();
    const room = agentAddress.toLowerCase();
    if (socketIo) {
      socketIo.to(room).emit('payment:made', {
        amount: payAmount,
        txHash,
        nullifierHash,
        newScore: updated.score,
        newTier: updated.tier,
      });
      socketIo.to(room).emit('score:updated', {
        newScore: updated.score,
        newTier: updated.tier,
        tierLabel: ['Unverified', 'Basic', 'Verified', 'Trusted'][updated.tier] ?? 'Unknown',
      });
      console.log(`[WS] Emitted payment:made + score:updated to room ${room}`);
    }

    res.json({
      success: true,
      nullifierHash,
      txHash,
      newScore: updated.score,
      newTier: updated.tier,
      tierLabel: ['Unverified', 'Basic', 'Verified', 'Trusted'][updated.tier] ?? 'Unknown',
      amount: payAmount,
    });
  } catch (err) {
    if (err instanceof InvalidAddressError) return sendError(res, err);
    handleUnexpected(res, err, 'pay');
  }
});

router.get('/wallet', async (_req: Request, res: Response) => {
  const unlinkAddr = await getUnlinkAddress();
  res.json({
    address: getSignerAddress(),
    ...(unlinkAddr && { unlinkAddress: unlinkAddr }),
  });
});

router.post('/metadata', async (req: Request, res: Response) => {
  try {
    const { address, name, description, capabilities, avatar } = req.body as {
      address?: string;
      name?: string;
      description?: string;
      capabilities?: string[];
      avatar?: string;
    };

    if (!address) {
      res.status(400).json({ error: true, code: 'MISSING_FIELD', message: 'address is required' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: true, code: 'MISSING_FIELD', message: 'name is required' });
      return;
    }
    if (!description) {
      res.status(400).json({ error: true, code: 'MISSING_FIELD', message: 'description is required' });
      return;
    }

    validateAddress(address, 'address');

    const profile = await getAgentProfile(address);
    if (!profile.registered) {
      sendError(res, new AgentNotFoundError(address));
      return;
    }

    const agentMeta: AgentMetadata = {
      address,
      name,
      description,
      capabilities: capabilities ?? [],
      avatar,
      pinnedAt: new Date().toISOString(),
    };

    const { cid, metadataURI } = await pinMetadataToIPFS(agentMeta);
    await updateAgentMetadata(address, metadataURI);

    res.json({ success: true, cid, metadataURI });
  } catch (err) {
    if (err instanceof InvalidAddressError) return sendError(res, err);
    if (err instanceof AgentNotFoundError) return sendError(res, err);
    handleUnexpected(res, err, 'agent/metadata');
  }
});

router.get('/profile/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    validateAddress(address, 'address');

    const profile = await getAgentProfile(address);
    if (!profile.registered) {
      sendError(res, new AgentNotFoundError(address));
      return;
    }

    let metadata: AgentMetadata | null = null;
    if (profile.metadataURI) {
      try {
        metadata = await fetchMetadataFromIPFS(profile.metadataURI);
      } catch {
        // metadata fetch is best-effort; return the URI even if gateway is down
      }
    }

    res.json({
      address,
      registered: profile.registered,
      metadataURI: profile.metadataURI || null,
      registeredAt: profile.registeredAt,
      ...(metadata && { metadata }),
    });
  } catch (err) {
    if (err instanceof InvalidAddressError) return sendError(res, err);
    handleUnexpected(res, err, 'agent/profile');
  }
});

router.get('/score/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    validateAddress(address, 'address');

    const score = await getAgentScore(address);
    res.json({
      address,
      ...score,
      tierLabel: ['Unverified', 'Basic', 'Verified', 'Trusted'][score.tier] ?? 'Unknown',
    });
  } catch (err) {
    if (err instanceof InvalidAddressError) return sendError(res, err);
    handleUnexpected(res, err, 'agent/score');
  }
});

router.get('/compliance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    validateAddress(address, 'address');

    const data = await getComplianceData(address);
    res.json({
      address,
      paymentCount: data.paymentCount,
      nullifierHashes: data.nullifierHashes,
      note: 'Payment amounts are sealed — only nullifier hashes are auditable',
    });
  } catch (err) {
    if (err instanceof InvalidAddressError) return sendError(res, err);
    handleUnexpected(res, err, 'agent/compliance');
  }
});

router.get('/discover', async (req: Request, res: Response) => {
  try {
    const minTier = Number(req.query.minTier ?? 0);
    if (isNaN(minTier) || minTier < 0 || minTier > 3) {
      res.status(400).json({ error: true, code: 'INVALID_PARAM', message: 'minTier must be 0-3' });
      return;
    }

    const agents = await discoverAgents(minTier);

    const agentsWithScores = await Promise.all(
      agents.map(async (addr: string) => {
        try {
          const score = await getAgentScore(addr);
          return { address: addr, ...score };
        } catch {
          return { address: addr, score: 0, tier: 0, totalPayments: 0, lastPaymentTimestamp: 0 };
        }
      }),
    );

    res.json({ minTier, count: agentsWithScores.length, agents: agentsWithScores });
  } catch (err) {
    handleUnexpected(res, err, 'agents/discover');
  }
});

export default router;
