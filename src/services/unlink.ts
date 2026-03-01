import { ethers } from 'ethers';
import { getReputationRegistry, getProvider, safeContractCall } from './contracts.js';

export interface ShieldedTransferResult {
  txHash: string;
  nullifierHash: string;
  amount: string;
}

export interface ShieldedTransferResultWithReceipt extends ShieldedTransferResult {
  blockNumber: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let unlinkInstance: import('@unlink-xyz/core').Unlink | null = null;
let unlinkInitialized = false;
let usingMock = false;
let unlinkAddr = '';

const MON_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

export async function initUnlink(): Promise<void> {
  if (process.env.UNLINK_MOCK === 'true') {
    console.log('[Unlink] Running in MOCK mode (UNLINK_MOCK=true)');
    usingMock = true;
    unlinkInitialized = true;
    return;
  }

  try {
    const { Unlink, createMemoryStorage } = await import('@unlink-xyz/core');

    const storage = createMemoryStorage();
    unlinkInstance = await Unlink.create({ chain: 'monad-testnet', storage });

    const exists = await unlinkInstance.seed.exists();
    if (!exists) {
      if (process.env.UNLINK_MNEMONIC) {
        await unlinkInstance.seed.importMnemonic(process.env.UNLINK_MNEMONIC);
        console.log('[Unlink] Imported wallet from UNLINK_MNEMONIC');
      } else {
        const { mnemonic } = await unlinkInstance.seed.create();
        console.log('[Unlink] Created new wallet. SAVE THIS MNEMONIC:', mnemonic);
      }
    } else if (process.env.UNLINK_MNEMONIC) {
      try {
        await unlinkInstance.seed.importMnemonic(process.env.UNLINK_MNEMONIC, { overwrite: true });
      } catch {
        console.log('[Unlink] Using existing wallet seed');
      }
    }

    let accounts = await unlinkInstance.accounts.list();
    if (accounts.length === 0) {
      await unlinkInstance.accounts.create();
      accounts = await unlinkInstance.accounts.list();
    }
    await unlinkInstance.accounts.setActive(0);
    unlinkInstance.startAutoSync(5000);

    unlinkAddr = accounts[0]?.address ?? '';
    console.log(`[Unlink] SDK initialized on Monad testnet. Address: ${unlinkAddr}`);

    usingMock = false;
    unlinkInitialized = true;
  } catch (err) {
    console.warn('[Unlink] SDK init failed, falling back to mock:', err instanceof Error ? err.message : err);
    usingMock = true;
    unlinkInitialized = true;
  }
}

export function isUnlinkReady(): boolean {
  return unlinkInitialized;
}

export function isUsingMock(): boolean {
  return usingMock;
}

// ---------------------------------------------------------------------------
// Shielded transfers
// ---------------------------------------------------------------------------

export async function executeShieldedTransfer(
  to: string,
  amount: string,
  agentAddress: string,
): Promise<ShieldedTransferResult> {
  if (usingMock || !unlinkInstance) {
    return mockShieldedTransfer(to, amount, agentAddress);
  }

  try {
    const amountWei = ethers.parseEther(amount);

    const result = await unlinkInstance.send({
      token: MON_TOKEN,
      recipient: to,
      amount: amountWei,
    });

    const status = await unlinkInstance.confirmTransaction(result.relayId, { timeout: 60_000 });

    const notes = await unlinkInstance.getNotes();
    const spentNotes = notes.filter((n: any) => n.spentAtIndex !== undefined);
    const latestNullifier = spentNotes.length > 0
      ? spentNotes[spentNotes.length - 1].nullifier
      : result.relayId;

    const txHash = status.txHash ?? result.relayId;
    return {
      txHash,
      nullifierHash: latestNullifier,
      amount,
    };
  } catch (err) {
    console.warn('[Unlink] Real transfer failed, falling back to mock:', err instanceof Error ? err.message : err);
    return mockShieldedTransfer(to, amount, agentAddress);
  }
}

/**
 * Execute a shielded transfer and return full chain receipt (txHash, nullifier, blockNumber, timestamp).
 * Throws when using mock Unlink — real chain data only.
 */
export async function executeShieldedTransferWithReceipt(
  to: string,
  amount: string,
  agentAddress: string,
): Promise<ShieldedTransferResultWithReceipt> {
  if (usingMock || !unlinkInstance) {
    throw new Error('Shielded relay requires real Unlink SDK. Mock mode cannot return chain data.');
  }

  const amountWei = ethers.parseEther(amount);

  const result = await unlinkInstance.send({
    token: MON_TOKEN,
    recipient: to,
    amount: amountWei,
  });

  const status = await unlinkInstance.confirmTransaction(result.relayId, { timeout: 60_000 });

  const notes = await unlinkInstance.getNotes();
  const spentNotes = notes.filter((n: any) => n.spentAtIndex !== undefined);
  const latestNullifier = spentNotes.length > 0
    ? spentNotes[spentNotes.length - 1].nullifier
    : result.relayId;

  const txHash = status.txHash ?? result.relayId;
  let blockNumber: number;
  let timestamp: number;

  const relayStatus = await unlinkInstance.getTxStatus(result.relayId);
  if (relayStatus.receipt?.blockNumber != null) {
    blockNumber = relayStatus.receipt.blockNumber;
    const block = await getProvider().getBlock(blockNumber);
    timestamp = block.timestamp != null ? block.timestamp : Math.floor(Date.now() / 1000);
  } else if (relayStatus.txHash) {
    const tx = await getProvider().getTransaction(relayStatus.txHash);
    if (tx?.blockNumber != null) {
      blockNumber = tx.blockNumber;
      const block = await getProvider().getBlock(blockNumber);
      timestamp = block.timestamp != null ? block.timestamp : Math.floor(Date.now() / 1000);
    } else {
      blockNumber = await getProvider().getBlockNumber();
      const block = await getProvider().getBlock(blockNumber);
      timestamp = block.timestamp != null ? block.timestamp : Math.floor(Date.now() / 1000);
    }
  } else {
    blockNumber = await getProvider().getBlockNumber();
    const block = await getProvider().getBlock(blockNumber);
    timestamp = block.timestamp != null ? block.timestamp : Math.floor(Date.now() / 1000);
  }

  return {
    txHash,
    nullifierHash: latestNullifier,
    amount,
    blockNumber,
    timestamp,
  };
}

// ---------------------------------------------------------------------------
// Balance & deposit
// ---------------------------------------------------------------------------

export async function getShieldedBalance(token?: string): Promise<string> {
  if (usingMock || !unlinkInstance) return '1000000';

  try {
    const bal = await unlinkInstance.getBalance(token ?? MON_TOKEN);
    return bal.toString();
  } catch {
    return '0';
  }
}

export async function getAllBalances(): Promise<Record<string, string>> {
  if (usingMock || !unlinkInstance) return { [MON_TOKEN]: '1000000' };

  try {
    const bals = await unlinkInstance.getBalances();
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(bals)) {
      out[k] = (v as bigint).toString();
    }
    return out;
  } catch {
    return {};
  }
}

export async function deposit(
  amount: bigint,
  depositorAddress: string,
  token?: string,
): Promise<{ relayId: string; calldata: string; to: string; value: bigint } | null> {
  if (usingMock || !unlinkInstance) return null;

  const result = await unlinkInstance.deposit({
    token: token ?? MON_TOKEN,
    amount,
    depositor: depositorAddress,
  });

  return {
    relayId: result.relayId,
    calldata: result.calldata,
    to: result.to,
    value: result.value,
  };
}

export async function withdraw(
  amount: bigint,
  recipientAddress: string,
  token?: string,
): Promise<{ relayId: string } | null> {
  if (usingMock || !unlinkInstance) return null;

  const result = await unlinkInstance.withdraw({
    token: token ?? MON_TOKEN,
    amount,
    recipient: recipientAddress,
  });

  return { relayId: result.relayId };
}

// ---------------------------------------------------------------------------
// Wallet info
// ---------------------------------------------------------------------------

export async function getUnlinkAddress(): Promise<string> {
  return unlinkAddr;
}

export async function getHistory(): Promise<unknown[]> {
  if (usingMock || !unlinkInstance) return [];

  try {
    return await unlinkInstance.getHistory();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Nullifier verification (on-chain, works regardless of mock/real)
// ---------------------------------------------------------------------------

export async function verifyNullifier(nullifierHash: string): Promise<boolean> {
  const reputation = getReputationRegistry();
  return safeContractCall('usedNullifiers', () =>
    reputation.usedNullifiers(nullifierHash),
  );
}

// ---------------------------------------------------------------------------
// Mock fallback
// ---------------------------------------------------------------------------

function mockShieldedTransfer(
  to: string,
  amount: string,
  agentAddress: string,
): ShieldedTransferResult {
  const nonce = Date.now().toString() + Math.random().toString(36).slice(2);
  const nullifierHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address', 'address', 'string', 'string'],
      [agentAddress, to, amount, nonce],
    ),
  );
  const txHash = ethers.keccak256(
    ethers.toUtf8Bytes(`shielded-tx-${nullifierHash}-${Date.now()}`),
  );
  return { txHash, nullifierHash, amount };
}
