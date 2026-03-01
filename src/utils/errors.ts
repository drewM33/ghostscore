import type { Response } from 'express';

export interface AppError {
  error: true;
  code: string;
  message: string;
}

export class GhostScoreError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'GhostScoreError';
  }

  toJSON(): AppError & { details?: Record<string, unknown> } {
    return {
      error: true,
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

export class PaymentRequiredError extends GhostScoreError {
  constructor(
    public readonly price: string,
    public readonly token: string,
    public readonly recipient: string,
    public readonly apiId?: number,
  ) {
    super('PAYMENT_REQUIRED', 'x402 payment required', 402, {
      price,
      token,
      recipient,
      apiId,
    });
  }
}

export class InsufficientTierError extends GhostScoreError {
  constructor(
    public readonly requiredTier: number,
    public readonly currentTier: number,
    public readonly requiredScore: number,
    public readonly currentScore: number,
  ) {
    super('INSUFFICIENT_TIER', `Agent tier ${requiredTier} required, you have tier ${currentTier}`, 403, {
      requiredTier,
      currentTier,
      requiredScore,
      currentScore,
    });
  }
}

export class NullifierReusedError extends GhostScoreError {
  constructor() {
    super('NULLIFIER_REUSED', 'This nullifier hash has already been used', 409);
  }
}

export class AgentNotFoundError extends GhostScoreError {
  constructor(address: string) {
    super('AGENT_NOT_FOUND', `Agent ${address} is not registered`, 404);
  }
}

export class InvalidAddressError extends GhostScoreError {
  constructor(field: string) {
    super('INVALID_ADDRESS', `Invalid Ethereum address for ${field}`, 400);
  }
}

export class ContractCallError extends GhostScoreError {
  constructor(method: string, reason: string) {
    super('CONTRACT_ERROR', `Contract call ${method} failed: ${reason}`, 500);
  }
}

export class RateLimitError extends GhostScoreError {
  constructor(retryAfterSec: number) {
    super('RATE_LIMITED', 'Too many requests', 429, { retryAfterSec });
  }
}

export function sendError(res: Response, err: GhostScoreError): void {
  res.status(err.statusCode).json(err.toJSON());
}

export function handleUnexpected(res: Response, err: unknown, context: string): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}]`, err);
  res.status(500).json({
    error: true,
    code: 'INTERNAL_ERROR',
    message: `Unexpected error in ${context}: ${message}`,
  });
}
