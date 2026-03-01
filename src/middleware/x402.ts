import type { Request, Response, NextFunction } from 'express';
import { ethers } from 'ethers';
import { executeShieldedTransfer, verifyNullifier } from '../services/unlink.js';
import { submitFeedback, submitValidation } from '../services/reputation.js';
import { getAPIGatekeeper, safeContractCall } from '../services/contracts.js';
import { PaymentRequiredError, NullifierReusedError, sendError, handleUnexpected } from '../utils/errors.js';

export interface X402Config {
  price: string;
  token: string;
  recipient: string;
  apiId: number;
}

const USDC_TOKEN = process.env.USDC_TOKEN_ADDRESS ?? '0x0000000000000000000000000000000000000000';

export function createX402Config(price: string, apiId: number): X402Config {
  return {
    price,
    token: USDC_TOKEN,
    recipient: process.env.PAYMENT_RECIPIENT ?? '0x0000000000000000000000000000000000000000',
    apiId,
  };
}

/**
 * x402 payment verification middleware.
 *
 * Flow:
 * 1. Check for X-Payment header (contains agent address + payment proof)
 * 2. If absent → 402 with payment requirement headers
 * 3. If present → verify payment via Unlink, extract nullifier, update reputation
 * 4. Attach payment result to request for downstream handlers
 */
export function x402Middleware(config: X402Config) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paymentHeader = req.headers['x-payment'] as string | undefined;
      const agentAddress = req.headers['x-agent-address'] as string | undefined;

      if (!paymentHeader || !agentAddress) {
        const err = new PaymentRequiredError(config.price, config.token, config.recipient, config.apiId);
        res.status(402);
        res.set({
          'X-Payment-Required': 'true',
          'X-Price': config.price,
          'X-Token': config.token,
          'X-Recipient': config.recipient,
          'X-Api-Id': config.apiId.toString(),
        });
        sendError(res, err);
        return;
      }

      if (!ethers.isAddress(agentAddress)) {
        res.status(400).json({ error: true, code: 'INVALID_ADDRESS', message: 'Invalid X-Agent-Address' });
        return;
      }

      const { txHash, nullifierHash } = await executeShieldedTransfer(
        config.recipient,
        config.price,
        agentAddress,
      );

      const alreadyUsed = await verifyNullifier(nullifierHash);
      if (alreadyUsed) {
        sendError(res, new NullifierReusedError());
        return;
      }

      const paymentWeight = ethers.parseUnits(config.price, 6);

      await submitFeedback(agentAddress, nullifierHash, paymentWeight, config.apiId);

      const gatekeeper = getAPIGatekeeper();
      await safeContractCall('recordCall', () =>
        gatekeeper.recordCall(agentAddress, config.apiId, paymentWeight),
      );

      (req as Request & { x402: X402PaymentResult }).x402 = {
        agentAddress,
        txHash,
        nullifierHash,
        amount: config.price,
        apiId: config.apiId,
      };

      next();
    } catch (err) {
      if (err && typeof err === 'object' && 'statusCode' in err) {
        sendError(res, err as import('../utils/errors.js').GhostScoreError);
        return;
      }
      handleUnexpected(res, err, 'x402Middleware');
    }
  };
}

export interface X402PaymentResult {
  agentAddress: string;
  txHash: string;
  nullifierHash: string;
  amount: string;
  apiId: number;
}

/**
 * Post-handler: submit validation proof after successful API response.
 * Call this in your route handler after serving data.
 */
export async function submitPostCallValidation(
  agentAddress: string,
  apiId: number,
  success: boolean,
): Promise<void> {
  try {
    const actionHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint8', 'uint256'],
        [agentAddress, apiId, Date.now()],
      ),
    );
    await submitValidation(agentAddress, actionHash, success);
  } catch (err) {
    console.error('[x402] Post-call validation failed (non-blocking):', err);
  }
}
