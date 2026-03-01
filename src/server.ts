import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '..', '.env') });

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { ethers } from 'ethers';
import {
  getProvider,
  getSigner,
  getSignerAddress,
  getAPIGatekeeper,
  getReputationRegistry,
  getValidationRegistry,
  getContractAddresses,
  checkRpcConnection,
  checkContractDeployed,
  safeContractCall,
  sleep,
} from './services/contracts.js';
import { initUnlink, isUnlinkReady, isUsingMock } from './services/unlink.js';
import agentRoutes from './routes/agent.js';
import providerRoutes from './routes/provider.js';
import apiRoutes, { setApiIds } from './routes/api.js';

const PORT = Number(process.env.PORT ?? 3000);
const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*' },
});

// Export io so route handlers can emit events
export { io };

import { setSocketIO } from './socket.js';
setSocketIO(io);

app.use(cors());
app.use(express.json());

// --- Socket.IO connection handling ---
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on('join', (agentAddress: string) => {
    const room = agentAddress?.toLowerCase?.() ?? agentAddress;
    socket.join(room);
    console.log(`[WS] ${socket.id} joined room ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

app.get('/health', async (_req, res) => {
  const addresses = getContractAddresses();
  const [rpc, identityDeployed, reputationDeployed, gatekeeperDeployed] = await Promise.all([
    checkRpcConnection(),
    checkContractDeployed(addresses.AgentIdentityRegistry),
    checkContractDeployed(addresses.ReputationRegistry),
    checkContractDeployed(addresses.APIGatekeeper),
  ]);

  const status = rpc && identityDeployed && reputationDeployed && gatekeeperDeployed && isUnlinkReady();

  res.status(status ? 200 : 503).json({
    status: status ? 'healthy' : 'degraded',
    signer: getSignerAddress(),
    dependencies: {
      rpc: rpc ? 'connected' : 'disconnected',
      unlink: isUnlinkReady()
        ? isUsingMock() ? 'connected (mock)' : 'connected (real SDK)'
        : 'disconnected',
      contracts: {
        AgentIdentityRegistry: identityDeployed ? 'deployed' : 'missing',
        ReputationRegistry: reputationDeployed ? 'deployed' : 'missing',
        APIGatekeeper: gatekeeperDeployed ? 'deployed' : 'missing',
      },
    },
    addresses,
    timestamp: new Date().toISOString(),
  });
});

app.use('/', agentRoutes);
app.use('/agent', agentRoutes);
app.use('/agents', agentRoutes);
app.use('/provider', providerRoutes);
app.use('/api', apiRoutes);

const frontendDist = resolve(__dirname, '..', 'frontend', 'dist');
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/api') || _req.path.startsWith('/agent') ||
        _req.path.startsWith('/agents') || _req.path.startsWith('/provider') ||
        _req.path.startsWith('/health') || _req.path.startsWith('/pay') ||
        _req.path.startsWith('/governance') || _req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(resolve(frontendDist, 'index.html'));
  });
}

async function registerAPIs(): Promise<void> {
  const gatekeeper = getAPIGatekeeper();

  const existing = Number(await safeContractCall('nextApiId', () => gatekeeper.nextApiId()));
  if (existing >= 5) {
    console.log(`[Startup] APIs already registered (nextApiId=${existing}). Skipping.`);
    setApiIds({ MARKET_DATA: 0, AGENT_DISCOVERY: 1, AGENT_COORDINATION: 2, SHIELDED_RELAY: 3, ZK_ATTESTATION: 4 });
    return;
  }

  if (existing >= 3) {
    console.log(`[Startup] Registering APIs 4 and 5 on-chain...`);
  } else {
    console.log('[Startup] Registering tiered APIs on-chain...');
  }

  const allApis = [
    { tier: 1, price: ethers.parseUnits('0.001', 6), name: 'Market Data' },
    { tier: 2, price: ethers.parseUnits('0.005', 6), name: 'Agent Discovery (ERC-8004)' },
    { tier: 3, price: ethers.parseUnits('0.01', 6), name: 'Agent Coordination' },
    { tier: 1, price: ethers.parseUnits('0.002', 6), name: 'Shielded Transfer Relay' },
    { tier: 2, price: ethers.parseUnits('0.008', 6), name: 'ZK Identity Attestation' },
  ];

  const apisToRegister = existing >= 3 ? allApis.slice(3, 5) : allApis;
  const ids: number[] = existing >= 3 ? [0, 1, 2] : [];

  for (const api of apisToRegister) {
    try {
      const tx = await safeContractCall('registerAPI', () =>
        gatekeeper.registerAPI(api.tier, api.price, api.name),
      );
      const receipt = await tx.wait();

      const event = receipt.logs.find((log: ethers.Log) => {
        try {
          const parsed = gatekeeper.interface.parseLog({ topics: [...log.topics], data: log.data });
          return parsed?.name === 'APIRegistered';
        } catch {
          return false;
        }
      });

      let apiId = ids.length;
      if (event) {
        const parsed = gatekeeper.interface.parseLog({ topics: [...event.topics], data: event.data });
        if (parsed) apiId = Number(parsed.args[0]);
      }

      ids.push(apiId);
      console.log(`  [API] "${api.name}" → id=${apiId}, tier=${api.tier}, price=${ethers.formatUnits(api.price, 6)} USDC`);
    } catch (err) {
      console.error(`  [API] Failed to register "${api.name}":`, err);
      ids.push(ids.length);
    }
  }

  setApiIds({
    MARKET_DATA: ids[0],
    AGENT_DISCOVERY: ids[1],
    AGENT_COORDINATION: ids[2],
    SHIELDED_RELAY: ids[3],
    ZK_ATTESTATION: ids[4],
  });
}

async function authorizeMiddleware(): Promise<void> {
  try {
    const gatekeeper = getAPIGatekeeper();
    const signerAddr = getSignerAddress();
    const isAuthorized = await gatekeeper.authorizedMiddleware(signerAddr);

    if (!isAuthorized) {
      console.log(`[Startup] Authorizing middleware signer ${signerAddr}...`);
      const tx = await safeContractCall('setMiddleware', () =>
        gatekeeper.setMiddleware(signerAddr, true),
      );
      await tx.wait();
      console.log('[Startup] Middleware signer authorized.');
    }
  } catch (err) {
    console.warn('[Startup] Could not authorize middleware (may not be admin):', err);
  }
}

async function ensureOracleRole(): Promise<void> {
  try {
    const reputation = getReputationRegistry();
    const signerAddr = getSignerAddress();
    const currentOracle = await reputation.oracle();

    if (currentOracle.toLowerCase() !== signerAddr.toLowerCase()) {
      console.log(`[Startup] Current oracle is ${currentOracle}, setting to signer ${signerAddr}...`);
      const tx = await safeContractCall('setOracle', () =>
        reputation.setOracle(signerAddr),
      );
      await tx.wait();
      console.log('[Startup] Oracle role transferred to middleware signer.');
    } else {
      console.log(`[Startup] Signer already has oracle role.`);
    }
  } catch (err) {
    console.warn('[Startup] Could not set oracle role (may not be admin):', err);
  }
}

async function authorizeProvider(): Promise<void> {
  try {
    const validation = getValidationRegistry();
    const signerAddr = getSignerAddress();
    const isProvider = await validation.authorizedProviders(signerAddr);

    if (!isProvider) {
      console.log(`[Startup] Adding signer as authorized validation provider...`);
      const tx = await safeContractCall('addProvider', () =>
        validation.addProvider(signerAddr),
      );
      await tx.wait();
      console.log('[Startup] Validation provider authorized.');
    }
  } catch (err) {
    console.warn('[Startup] Could not authorize validation provider:', err);
  }
}

async function startup(): Promise<void> {
  console.log('\\n=== Ghost Score Backend ===\\n');

  console.log(`[ENV] MONAD_RPC_URL = ${process.env.MONAD_RPC_URL ?? '(not set)'}`);
  console.log(`[ENV] DEPLOYER_PRIVATE_KEY = ${process.env.DEPLOYER_PRIVATE_KEY ? '***set***' : '(not set)'}`);

  const rpcOk = await checkRpcConnection();
  if (!rpcOk) {
    console.warn('[WARN] Cannot connect to Monad RPC. Server will start in degraded mode.');
    console.warn('[WARN] Contract-dependent endpoints may fail until RPC is reachable.');
  } else {
    console.log(`[RPC] Connected to ${process.env.MONAD_RPC_URL}`);
  }

  await initUnlink();

  if (rpcOk) {
    try {
      const signer = getSigner();
      const balance = await getProvider().getBalance(signer.address);
      console.log(`[Signer] ${signer.address} (balance: ${ethers.formatEther(balance)} MON)`);

      await authorizeMiddleware();
      await sleep(500);
      await authorizeProvider();
      await sleep(500);
      await ensureOracleRole();
      await sleep(500);
      await registerAPIs();
    } catch (err) {
      console.warn('[Startup] On-chain setup partially failed (server will still start):', err);
    }
  }

  httpServer.listen(PORT, () => {
    console.log(`\\n[Server] Listening on http://localhost:${PORT}`);
    console.log('[Server] Endpoints:');
    console.log('  GET  /health');
    console.log('  POST /pay                         (reputation onramp, no tier gate)');
    console.log('  POST /agent/register');
    console.log('  GET  /agent/wallet');
    console.log('  GET  /agent/profile/:address');
    console.log('  GET  /agent/score/:address');
    console.log('  GET  /agent/compliance/:address');
    console.log('  GET  /agents/discover?minTier=N');
    console.log('  POST /provider/register');
    console.log('  GET  /provider/apis');
    console.log('  GET  /api/market-data            (Tier 1, 0.001 USDC)');
    console.log('  GET  /api/agents/discover         (Tier 2, 0.005 USDC)');
    console.log('  POST /api/agents/coordinate       (Tier 3, 0.01 USDC)');
    console.log('  GET  /api/shielded-relay          (Tier 1, 0.002 USDC)');
    console.log('  GET  /api/zk-attestation          (Tier 2, 0.008 USDC)');
    console.log('\\nReady.\\n');
  });
}

startup().catch((err) => {
  console.error('[FATAL] Startup failed:', err);
  process.exit(1);
});
