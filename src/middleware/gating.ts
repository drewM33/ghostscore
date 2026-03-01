import type { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { getAPIGatekeeper, safeContractCall } from '../services/contracts.js';
import { getAgentScore } from '../services/reputation.js';
import { InsufficientTierError, sendError, handleUnexpected } from '../utils/errors.js';
import type { X402Config } from './x402.js';
import { x402Middleware } from './x402.js';

const TIER_THRESHOLDS = [0, 20, 50, 80] as const;

/**
 * Combined tier check + x402 payment gating.
 *
 * Applied to all /api/* routes:
 * 1. Read X-Agent-Address header
 * 2. Call APIGatekeeper.checkAccess(agentAddress, apiId) on-chain
 * 3. If tier insufficient → 403 with score details
 * 4. If tier sufficient but no payment → delegate to x402 middleware (returns 402)
 * 5. If both pass → proceed to handler
 */
export function gatingMiddleware(config: X402Config) {
  const paymentMiddleware = x402Middleware(config);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const agentAddress = req.headers['x-agent-address'] as string | undefined;

      if (!agentAddress) {
        res.status(400).json({
          error: true,
          code: 'MISSING_AGENT',
          message: 'X-Agent-Address header is required',
        });
        return;
      }

      if (!ethers.isAddress(agentAddress)) {
        res.status(400).json({
          error: true,
          code: 'INVALID_ADDRESS',
          message: 'Invalid X-Agent-Address',
        });
        return;
      }

      const gatekeeper = getAPIGatekeeper();
      const hasAccess = await safeContractCall('checkAccess', () =>
        gatekeeper.checkAccess(agentAddress, config.apiId),
      );

      if (!hasAccess) {
        const scoreData = await getAgentScore(agentAddress);

        const apiInfo = await safeContractCall('getAPI', () =>
          gatekeeper.getAPI(config.apiId),
        );
        const requiredTier = Number(apiInfo[1]);
        const requiredScore = TIER_THRESHOLDS[requiredTier] ?? 0;

        sendError(
          res,
          new InsufficientTierError(requiredTier, scoreData.tier, requiredScore, scoreData.score),
        );
        return;
      }

      paymentMiddleware(req, res, next);
    } catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in err) {
        sendError(res, err as import('../utils/errors.js').GhostScoreError);
        return;
      }
      handleUnexpected(res, err, 'gatingMiddleware');
    }
  };
}
