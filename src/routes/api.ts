import { Router, type Request, type Response } from 'express';
import { ethers } from 'ethers';
import { gatingMiddleware } from '../middleware/gating.js';
import { createX402Config, submitPostCallValidation, type X402PaymentResult } from '../middleware/x402.js';
import { getMarketData } from '../services/coingecko.js';
import { discoverAgents, getAgentScore, getAgentProfile } from '../services/reputation.js';
import { executeShieldedTransfer, executeShieldedTransferWithReceipt } from '../services/unlink.js';
import { submitFeedback } from '../services/reputation.js';
import { handleUnexpected } from '../utils/errors.js';
import { getSocketIO } from '../socket.js';
import { getSigner, getSignerAddress } from '../services/contracts.js';

const router = Router();

// API IDs are assigned at startup when registerAPIs() runs.
// These defaults get overwritten — see server.ts.
export let API_IDS = {
  MARKET_DATA: 0,
  AGENT_DISCOVERY: 1,
  AGENT_COORDINATION: 2,
  SHIELDED_RELAY: 3,
  ZK_ATTESTATION: 4,
};

export type ApiIds = {
  MARKET_DATA: number;
  AGENT_DISCOVERY: number;
  AGENT_COORDINATION: number;
  SHIELDED_RELAY: number;
  ZK_ATTESTATION: number;
};

export function setApiIds(ids: ApiIds) {
  API_IDS = ids;
}

function emitPaymentEvents(agentAddress: string, payment: X402PaymentResult, updated: { score: number; tier: number }) {
  const socketIo = getSocketIO();
  const room = agentAddress.toLowerCase();
  if (socketIo) {
    socketIo.to(room).emit('payment:made', {
      amount: payment.amount,
      txHash: payment.txHash,
      nullifierHash: payment.nullifierHash,
      newScore: updated.score,
      newTier: updated.tier,
    });
    socketIo.to(room).emit('score:updated', {
      newScore: updated.score,
      newTier: updated.tier,
      tierLabel: ['Unverified', 'Basic', 'Verified', 'Trusted'][updated.tier] ?? 'Unknown',
    });
    console.log(`[WS] Emitted payment:made + score:updated to room ${room} (API call)`);
  }
}

/**
 * Tier 1 (score >= 20): GET /api/market-data
 * CoinGecko BTC, ETH, MON prices with 60s cache.
 * Price: 0.001 USDC per call via x402.
 */
router.get(
  '/market-data',
  (req, res, next) => {
    const config = createX402Config('0.001', API_IDS.MARKET_DATA);
    gatingMiddleware(config)(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const payment = (req as Request & { x402: X402PaymentResult }).x402;
      const data = await getMarketData();

      submitPostCallValidation(payment.agentAddress, payment.apiId, true).catch(() => {});

      const updated = await getAgentScore(payment.agentAddress);
      emitPaymentEvents(payment.agentAddress, payment, updated);

      res.json({
        ...data,
        payment: {
          txHash: payment.txHash,
          nullifierHash: payment.nullifierHash,
          amount: payment.amount,
        },
      });
    } catch (err) {
      handleUnexpected(res, err, 'api/market-data');
    }
  },
);

/**
 * Tier 2 (score >= 50): GET /api/agents/discover
 * ERC-8004 agent discovery endpoint.
 * Returns agent addresses, scores, tiers, metadata URIs.
 * Price: 0.005 USDC per call via x402.
 */
router.get(
  '/agents/discover',
  (req, res, next) => {
    const config = createX402Config('0.005', API_IDS.AGENT_DISCOVERY);
    gatingMiddleware(config)(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const payment = (req as Request & { x402: X402PaymentResult }).x402;
      const minTier = Number(req.query.minTier ?? 0);

      const agentAddresses = await discoverAgents(minTier);

      const agents = await Promise.all(
        agentAddresses.map(async (addr: string) => {
          const [score, profile] = await Promise.all([
            getAgentScore(addr).catch(() => ({ score: 0, tier: 0, totalPayments: 0, lastPaymentTimestamp: 0 })),
            getAgentProfile(addr).catch(() => ({ registered: false, metadataURI: '', registeredAt: 0 })),
          ]);
          return {
            address: addr,
            score: score.score,
            tier: score.tier,
            tierLabel: ['Unverified', 'Basic', 'Verified', 'Trusted'][score.tier] ?? 'Unknown',
            metadataURI: profile.metadataURI || null,
            totalPayments: score.totalPayments,
          };
        }),
      );

      submitPostCallValidation(payment.agentAddress, payment.apiId, true).catch(() => {});

      const updated = await getAgentScore(payment.agentAddress);
      emitPaymentEvents(payment.agentAddress, payment, updated);

      res.json({
        agents,
        count: agents.length,
        minTier,
        payment: {
          txHash: payment.txHash,
          nullifierHash: payment.nullifierHash,
          amount: payment.amount,
        },
      });
    } catch (err) {
      handleUnexpected(res, err, 'api/agents/discover');
    }
  },
);

/**
 * Tier 3 (score >= 80): POST /api/agents/coordinate
 * Private agent-to-agent transfer via Unlink.
 * Both agents' reputation scores update.
 * Price: 0.01 USDC per call via x402.
 *
 * This is the "holy shit" demo moment: two agents transacting privately,
 * both building reputation, with the transfer amount hidden on-chain.
 */
router.post(
  '/agents/coordinate',
  (req, res, next) => {
    const config = createX402Config('0.01', API_IDS.AGENT_COORDINATION);
    gatingMiddleware(config)(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const payment = (req as Request & { x402: X402PaymentResult }).x402;
      const { recipientAgent, amount, memo } = req.body as {
        recipientAgent?: string;
        amount?: string;
        memo?: string;
      };

      if (!recipientAgent || !ethers.isAddress(recipientAgent)) {
        res.status(400).json({ error: true, code: 'INVALID_RECIPIENT', message: 'Valid recipientAgent address required' });
        return;
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        res.status(400).json({ error: true, code: 'INVALID_AMOUNT', message: 'Positive amount required' });
        return;
      }

      const transfer = await executeShieldedTransfer(recipientAgent, amount, payment.agentAddress);

      const senderWeight = ethers.parseUnits(amount, 6);

      await submitFeedback(
        payment.agentAddress,
        transfer.nullifierHash,
        senderWeight,
        payment.apiId,
      );

      const recipientNullifier = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['bytes32', 'address', 'string'],
          [transfer.nullifierHash, recipientAgent, 'recipient'],
        ),
      );

      try {
        await submitFeedback(recipientAgent, recipientNullifier, senderWeight / 2n, payment.apiId);
      } catch (err) {
        console.warn('[coordinate] Recipient feedback failed (may not be registered):', err);
      }

      submitPostCallValidation(payment.agentAddress, payment.apiId, true).catch(() => {});

      const updated = await getAgentScore(payment.agentAddress);
      emitPaymentEvents(payment.agentAddress, payment, updated);

      res.json({
        success: true,
        coordination: {
          sender: payment.agentAddress,
          recipient: recipientAgent,
          amount,
          memo: memo ?? '',
          transferTxHash: transfer.txHash,
          transferNullifier: transfer.nullifierHash,
        },
        payment: {
          txHash: payment.txHash,
          nullifierHash: payment.nullifierHash,
          amount: payment.amount,
        },
        message: 'Private agent-to-agent transfer completed. Both agents\' reputation updated.',
      });
    } catch (err) {
      handleUnexpected(res, err, 'api/agents/coordinate');
    }
  },
);

/**
 * Tier 1 (score >= 20): GET /api/shielded-relay?to=ADDRESS&amount=AMOUNT
 * Execute a real shielded transfer through Unlink to the specified address.
 * Returns real tx hash, nullifier, block number, timestamp from chain.
 * Price: 0.002 USDC per call via x402.
 */
router.get(
  '/shielded-relay',
  (req, res, next) => {
    const config = createX402Config('0.002', API_IDS.SHIELDED_RELAY);
    gatingMiddleware(config)(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const payment = (req as Request & { x402: X402PaymentResult }).x402;
      const to = req.query.to as string | undefined;
      const amount = req.query.amount as string | undefined;

      if (!to || !ethers.isAddress(to)) {
        res.status(400).json({ error: true, code: 'INVALID_TO', message: 'Valid to address required' });
        return;
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        res.status(400).json({ error: true, code: 'INVALID_AMOUNT', message: 'Positive amount required' });
        return;
      }

      const transfer = await executeShieldedTransferWithReceipt(to, amount, payment.agentAddress);

      submitPostCallValidation(payment.agentAddress, payment.apiId, true).catch(() => {});

      const updated = await getAgentScore(payment.agentAddress);
      emitPaymentEvents(payment.agentAddress, payment, updated);

      res.json({
        success: true,
        transfer: {
          txHash: transfer.txHash,
          nullifierHash: transfer.nullifierHash,
          blockNumber: transfer.blockNumber,
          timestamp: transfer.timestamp,
          to,
          amount,
        },
        payment: {
          txHash: payment.txHash,
          nullifierHash: payment.nullifierHash,
          amount: payment.amount,
        },
      });
    } catch (err) {
      handleUnexpected(res, err, 'api/shielded-relay');
    }
  },
);

/**
 * Tier 2 (score >= 50): GET /api/zk-attestation?agent=ADDRESS&threshold=NUMBER
 * Read real score and tier from on-chain contracts, sign attestation with server signer.
 * Price: 0.008 USDC per call via x402.
 */
router.get(
  '/zk-attestation',
  (req, res, next) => {
    const config = createX402Config('0.008', API_IDS.ZK_ATTESTATION);
    gatingMiddleware(config)(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const payment = (req as Request & { x402: X402PaymentResult }).x402;
      const agent = req.query.agent as string | undefined;
      const threshold = req.query.threshold as string | undefined;

      if (!agent || !ethers.isAddress(agent)) {
        res.status(400).json({ error: true, code: 'INVALID_AGENT', message: 'Valid agent address required' });
        return;
      }
      const thresholdNum = threshold != null ? Number(threshold) : 0;
      if (isNaN(thresholdNum) || thresholdNum < 0) {
        res.status(400).json({ error: true, code: 'INVALID_THRESHOLD', message: 'Non-negative threshold required' });
        return;
      }

      const scoreData = await getAgentScore(agent);
      const realScore = scoreData.score;
      const realTier = scoreData.tier;
      const scoreMeetsThreshold = realScore >= thresholdNum;

      const signer = getSigner();
      const signerAddress = getSignerAddress();
      const timestamp = Math.floor(Date.now() / 1000);

      const messagePayload = JSON.stringify({
        agent,
        scoreMeetsThreshold,
        tier: realTier,
        score: realScore,
        threshold: thresholdNum,
        timestamp,
      });
      const attestation = await signer.signMessage(ethers.getBytes(ethers.toUtf8Bytes(messagePayload)));

      submitPostCallValidation(payment.agentAddress, payment.apiId, true).catch(() => {});

      const updated = await getAgentScore(payment.agentAddress);
      emitPaymentEvents(payment.agentAddress, payment, updated);

      res.json({
        attestation,
        scoreMeetsThreshold,
        tierVerified: realTier,
        signerAddress,
        timestamp,
        agent,
        score: realScore,
        threshold: thresholdNum,
        payment: {
          txHash: payment.txHash,
          nullifierHash: payment.nullifierHash,
          amount: payment.amount,
        },
      });
    } catch (err) {
      handleUnexpected(res, err, 'api/zk-attestation');
    }
  },
);

export default router;
