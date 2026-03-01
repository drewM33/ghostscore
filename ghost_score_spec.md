# Ghost Score — Hackathon Spec Sheet & Multi-Phase Execution Plan
## Unlink × Monad: Ship Private. Ship Fast. | Feb 27–Mar 1, 2026

---

## One-Liner
**Ghost Score is the credit bureau for the agentic economy** — a private reputation system where AI agents build verifiable trust scores through ZK-shielded x402 payments, then use those scores to unlock tiered API access.

---

## Prize Target Stack
| Prize | Amount | How We Win It |
|---|---|---|
| 🥇 1st Place (Main) | $10,000 | Full ERC-8004 implementation + x402 spine + live agent-to-agent demo |
| x402 Agents Track | $2,000 | x402 is the core payment rail, not a bolt-on |
| Best Use of Unlink SDK | $500 | Nullifier hashes as cryptographic reputation proofs + shielded agent coordination |
| **Total** | **$12,500** | |

---

## Judge Alignment Matrix
| Judge | Role | What They Probe | Our Answer |
|---|---|---|---|
| Jonah Burian | Investor, Blockchain Capital | Market opportunity, defensibility | "Credit infrastructure for the $B agentic economy. Network effects from agent reputation data." |
| Sean C | Principal, Aztec | Privacy architecture rigor, ZK depth | "Unlink nullifiers as on-chain payment proofs. Oracle trust assumption acknowledged — path to full ZK oracle via Aztec-style proving." |
| Fitz | Ecosystem, Monad Foundation | Deep Monad usage, leveraging speed | "Monad Execution Events SDK for real-time score streaming. Sub-second finality means reputation updates confirm before the next API call fires." |
| Jason Chaskin | App Relations, Ethereum Foundation | Standards alignment, ecosystem impact | "Full ERC-8004 implementation — Identity, Reputation, AND Validation registries. Built on the standard his ecosystem authored." |
| Iqram Magon-Ismail | Co-founder, Venmo | Real product, UX, would people use this? | "Venmo built trust for P2P. Ghost Score builds trust for agent-to-agent — privately. Live demo: two agents discover, transact, build reputation." |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND (Vite + React 19)             │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │ Agent Dash   │  │ Provider Dash  │  │ Compliance View│  │
│  │ - Score/Tier │  │ - Revenue      │  │ - Nullifiers   │  │
│  │ - Pay (x402) │  │ - Call counts  │  │ - Audit trail  │  │
│  │ - API access │  │ - Agent anon   │  │ - Governance   │  │
│  └──────┬───────┘  └───────┬────────┘  └───────┬────────┘  │
│         │ Monad Execution Events SDK (real-time)│           │
└─────────┼──────────────────┼───────────────────┼───────────┘
          │                  │                   │
┌─────────▼──────────────────▼───────────────────▼───────────┐
│              MIDDLEWARE / GATEWAY (Express :3000)            │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ x402    │ │ Unlink   │ │ Reputa-  │ │ API Gating    │  │
│  │ Payment │ │ Shielded │ │ tion     │ │ + Rate Limit  │  │
│  │ Verify  │ │ Transfer │ │ Oracle   │ │ + Tier Check  │  │
│  └────┬────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       │           │            │               │            │
└───────┼───────────┼────────────┼───────────────┼────────────┘
        │           │            │               │
┌───────▼───────────▼────────────▼───────────────▼────────────┐
│              MONAD TESTNET (Contracts)                        │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ AgentIdentity    │  │ ReputationRegistry (ERC-8004)    │ │
│  │ Registry.sol     │  │ - submitFeedback(nullifier,weight)│ │
│  │ - register()     │  │ - getScore() / getTier()         │ │
│  │ - updateMeta()   │  │ - weighted multi-factor scoring  │ │
│  │ - discover()     │  │ - nullifier dedup                │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │ ValidationReg    │  │ APIGatekeeper.sol                │ │
│  │ .sol             │  │ - registerAPI(tier, pricePerCall)│ │
│  │ - submitProof()  │  │ - checkAccess(agent, apiId)      │ │
│  │ - verifyAction() │  │ - recordCall(agent, apiId)       │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
│  ┌──────────────────┐                                       │
│  │ Governance.sol   │                                       │
│  │ - proposeOracle()│                                       │
│  │ - approve()      │                                       │
│  │ - pause()        │                                       │
│  └──────────────────┘                                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Reputation Scoring Algorithm

### Multi-Factor Weighted Score (0–100)

```
score = clamp(0, 100,
  (0.35 × volumeScore) +      // Larger payments = more trust
  (0.25 × frequencyScore) +   // Consistent activity over time
  (0.20 × diversityScore) +   // Interactions across multiple APIs
  (0.10 × recencyBonus) +     // Recent activity weighted higher
  (0.10 × uniquenessRatio)    // High unique nullifiers = real activity
)
```

### Tier Derivation
| Tier | Min Score | Access Level |
|---|---|---|
| 0 (Unverified) | 0 | No API access |
| 1 (Basic) | 20 | Market data, public endpoints |
| 2 (Verified) | 50 | Agent discovery, coordination endpoints |
| 3 (Trusted) | 80 | Private transfers, agent-to-agent payments |

---

## MoSCoW Prioritization

### Must-Have (Demo-Critical)
- All 5 contracts deployed to Monad testnet
- x402 payment flow end-to-end (402 → pay → access)
- Unlink shielded transfers with nullifier-based reputation
- Weighted reputation scoring (not a flat counter)
- 3-tab frontend dashboard with live data
- Monad Execution Events for real-time score updates
- Agent discovery endpoint (ERC-8004 Identity + Reputation)
- E2E demo script that runs flawlessly 5+ times

### Should-Have (Judge Impressors)
- ValidationRegistry (completes full ERC-8004 triad)
- Agent-to-agent coordination via Tier 3 API
- IPFS agent metadata (Pinata)
- Governance.sol (2-of-3 multisig for oracle rotation)
- Compliance view with governance log
- Provider API key auth + per-agent rate limiting

### Could-Have (If Time Permits)
- Multi-chain score sync via Wormhole
- Production hardening (Docker, TLS, structured logging)
- OpenAPI/Swagger documentation
- CI/CD pipeline

### Won't-Have (Cut for Hackathon)
- Mainnet deployment
- Full CI/CD with GitHub Actions
- Prometheus/Grafana monitoring stack
- Nginx reverse proxy + TLS certs

---

## Parallel Agent Streams & Dependency Map

```
TIME ──────────────────────────────────────────────────────►

STREAM 1 (Contracts):
  Phase 0 ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
  Output: ABIs + deployed addresses + .env

STREAM 2 (Backend):        ▼ depends on Stream 1 ABIs
  Phase 1 ░░░░░░░░████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░
  Phase 2 ░░░░░░░░░░░░░░░░░░░█████████░░░░░░░░░░░░░░░░░░░
  Phase 6 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████░░░░░░░░░░░░░░░

STREAM 3 (Frontend):       ▼ mocks until Stream 2 APIs ready
  Phase 4 ░░░░░░░░████████████████████░░░░░░░░░░░░░░░░░░░░
  Phase 3 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████░░░░░░░░░░░░░░░
         (Monad Events integration once backend stable)

STREAM 4 (Polish/Demo):                    ▼ all streams merge
  Phase 5 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████
  Phase 7 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████
         (E2E tests, IPFS, governance, demo hardening)
```

---

# EXECUTION PHASES

---

## Phase 0 — Smart Contracts (Stream 1)

### Cursor Agent Prompt

```xml
<role>Act as a senior Solidity developer specializing in ERC standards and ZK-privacy protocols on EVM chains.</role>

<task>Implement and deploy five smart contracts for Ghost Score, a private reputation system for AI agents, to Monad testnet.</task>

<context>
Ghost Score lets AI agents build verifiable reputation through ZK-shielded payments (via Unlink SDK). Agents pay for API access via x402, each payment simultaneously grants access AND builds reputation. Reputation is scored 0-100 with tiers at 20/50/80. The system implements ERC-8004 (Identity + Reputation + Validation registries).
Chain: Monad testnet (EVM-compatible, Solidity 0.8.20)
Framework: Hardhat
</context>

<requirements>
1. AgentIdentityRegistry.sol
   - registerAgent(address agent) → stores agent with block.timestamp
   - updateMetadata(address agent, string metadataURI) → IPFS URI for agent profile
   - getAgent(address) → returns (bool registered, string metadataURI, uint256 registeredAt)
   - discoverAgents(uint8 minTier) → returns address[] of agents meeting tier threshold (reads from ReputationRegistry)
   - Events: AgentRegistered, MetadataUpdated

2. ReputationRegistry.sol
   - ORACLE_ROLE: only authorized oracle can call submitFeedback
   - submitFeedback(address agent, bytes32 nullifierHash, uint256 paymentWeight, uint8 apiId) → rejects reused nullifiers, updates multi-factor score
   - Scoring: weighted rolling calculation using volumeScore (0.35), frequencyScore (0.25), diversityScore (0.20), recencyBonus (0.10), uniquenessRatio (0.10) — all normalized to 0-100 range
   - getTier(address) → 0 (<20), 1 (20-49), 2 (50-79), 3 (80+)
   - getScore(address) → returns (uint256 score, uint8 tier, uint256 totalPayments, uint256 lastPaymentTimestamp)
   - getFeedbackHistory(address) → returns nullifier hashes and timestamps
   - setOracle(address) → onlyAdmin
   - Events: FeedbackSubmitted, TierChanged, OracleUpdated

3. ValidationRegistry.sol
   - submitValidation(address agent, bytes32 actionHash, bool success) → provider confirms agent completed an API call
   - getValidationCount(address agent) → total validated actions
   - getValidationRate(address agent) → success / total ratio
   - Only registered API providers can submit validations
   - Events: ValidationSubmitted

4. APIGatekeeper.sol
   - registerAPI(uint8 requiredTier, uint256 pricePerCall, string name) → returns apiId
   - checkAccess(address agent, uint256 apiId) → bool (reads tier from ReputationRegistry)
   - recordCall(address agent, uint256 apiId) → increments usage counter (only middleware)
   - getAPI(uint256 apiId) → returns (string name, uint8 requiredTier, uint256 pricePerCall, uint256 totalCalls, uint256 totalRevenue)
   - getProviderAPIs(address provider) → returns apiId[]
   - Events: APIRegistered, APICallRecorded

5. Governance.sol
   - Lightweight 2-of-3 multisig pattern
   - proposeOracleChange(address newOracle) → creates proposal with 24h timelock
   - approveProposal(uint256 proposalId) → signer approves
   - executeProposal(uint256 proposalId) → executes after timelock + 2 approvals → calls ReputationRegistry.setOracle()
   - emergencyPause() → 2-of-3 can pause ReputationRegistry.submitFeedback()
   - Events: ProposalCreated, ProposalApproved, ProposalExecuted, EmergencyPause

Deployment:
- Hardhat config for Monad testnet (RPC from .env)
- deploy.ts script deploys all 5, links them (ReputationRegistry address into APIGatekeeper and AgentIdentityRegistry), authorizes oracle
- set-oracle.ts standalone script
- Output all addresses to .env and a deployed-addresses.json
</requirements>

<output>
Complete Hardhat project with:
- contracts/ (5 .sol files)
- scripts/deploy.ts, scripts/set-oracle.ts
- hardhat.config.ts (Monad testnet)
- .env.example with all required variables
- test/ directory with unit tests for each contract
All contracts compile with 0 warnings on Solidity 0.8.20.
</output>
```

### Exit Criteria
- [ ] All 5 contracts compile with 0 warnings
- [ ] Deployed to Monad testnet
- [ ] Oracle authorized on ReputationRegistry
- [ ] Manual ethers calls confirm: register agent → submitFeedback → score increases → tier derived → checkAccess returns true/false correctly
- [ ] deployed-addresses.json and .env populated

---

## Phase 1 — x402 + Unlink Core Backend (Stream 2)

### Cursor Agent Prompt

```xml
<role>Act as a senior Node.js/TypeScript backend developer with expertise in blockchain middleware, the x402 payment protocol, and privacy-preserving SDK integration.</role>

<task>Build the Ghost Score middleware server — an Express API gateway that uses x402 for pay-per-call API access and Unlink SDK for private payments that simultaneously build agent reputation on Monad.</task>

<context>
Ghost Score is a private reputation system for AI agents. The core loop:
1. Agent hits a gated API endpoint
2. Server returns HTTP 402 with x402 payment headers (price, token, recipient)
3. Agent pays via Unlink shielded transfer (private, ZK-proof based)
4. Server verifies payment, captures nullifier hash, updates reputation on-chain
5. Server serves the API response
6. Agent's reputation score rises, eventually unlocking higher-tier APIs

Every API call is simultaneously: a payment (x402), a private transfer (Unlink), and a reputation event (on-chain).

Stack: Express + TypeScript, Unlink SDK (@aspect-build/unlink or equivalent), x402 middleware
Chain: Monad testnet
Contracts: AgentIdentityRegistry, ReputationRegistry, ValidationRegistry, APIGatekeeper (addresses in .env)
</context>

<requirements>
1. Server setup (port 3000)
   - Express with TypeScript
   - Health check: GET /health → returns dependency status (RPC node, Unlink gateway, contract connectivity)
   - CORS enabled for frontend

2. Unlink SDK Integration
   - Initialize Unlink wallet on startup, connect to Monad pool/token
   - Utility: executeShieldedTransfer(to, amount) → returns { txHash, nullifierHash }
   - Utility: verifyNullifier(nullifierHash) → checks on-chain uniqueness
   - Auto-deposit: if shielded balance < threshold, deposit from EOA automatically

3. x402 Payment Middleware
   - For each gated endpoint, define: price (in USDC), token address, recipient address
   - On request without valid x402 payment: return HTTP 402 with headers (X-Payment-Required, X-Price, X-Token, X-Recipient)
   - On request with x402 payment header: verify payment via Unlink, extract nullifier, proceed
   - After successful payment: call ReputationRegistry.submitFeedback(agentAddress, nullifierHash, paymentWeight, apiId) on-chain
   - After successful API call: call ValidationRegistry.submitValidation(agentAddress, actionHash, true)

4. Agent Endpoints
   - POST /agent/register → calls AgentIdentityRegistry.registerAgent()
   - GET /agent/wallet → returns middleware signer address
   - GET /agent/profile/:address → resolves IPFS metadata URI from registry
   - GET /agent/score/:address → reads on-chain score, tier, payment count, feedback history
   - GET /agent/compliance/:address → returns nullifier hashes + payment count (auditable, amounts sealed)
   - GET /agents/discover?minTier=N → calls AgentIdentityRegistry.discoverAgents(minTier)

5. Provider Endpoints
   - POST /provider/register → generates API key, stores hashed on-chain or in memory
   - GET /provider/apis → returns per-API stats (total calls, revenue, name, tier requirement)

6. Contract interaction layer
   - ethers.js v6 with Monad testnet provider
   - Signer from .env private key
   - ABI imports from artifacts (or inline ABIs from deployed-addresses.json)
   - Structured error handling for all contract calls (gas estimation, revert decoding)

7. Error handling
   - Consistent error format: { error: boolean, code: string, message: string }
   - Proper HTTP status codes (400, 401, 402, 403, 404, 429, 500)
</requirements>

<output>
Complete Express + TypeScript server:
- src/server.ts (main)
- src/routes/ (agent.ts, provider.ts, api.ts)
- src/middleware/x402.ts (payment verification middleware)
- src/services/unlink.ts (Unlink SDK wrapper)
- src/services/reputation.ts (on-chain reputation interaction)
- src/services/contracts.ts (contract instances + ABIs)
- src/utils/errors.ts (structured error types)
- package.json with all dependencies
- tsconfig.json
</output>
```

### Exit Criteria
- [ ] Server starts, /health returns all-green
- [ ] POST /agent/register creates agent on-chain
- [ ] GET on a gated endpoint returns 402 with x402 headers
- [ ] Payment with Unlink shielded transfer → 200 response + score incremented on-chain
- [ ] Same nullifier reused → rejected
- [ ] GET /agent/score/:address returns accurate multi-factor score and tier
- [ ] GET /agents/discover?minTier=1 returns registered agents meeting threshold

---

## Phase 2 — Tiered API Endpoints (Stream 2, continued)

### Cursor Agent Prompt

```xml
<role>Act as the same senior backend developer continuing Phase 1.</role>

<task>Implement three tiered API endpoints behind x402 + reputation gating, each demonstrating increasing trust levels for AI agents.</task>

<context>
The middleware from Phase 1 is running. Agents have scores and tiers. Now we add real, useful APIs behind each tier that demonstrate the gating works. Each endpoint requires both: (a) sufficient reputation tier, and (b) x402 payment. The tier check happens via APIGatekeeper.checkAccess() on-chain. The payment happens via x402 + Unlink.
</context>

<requirements>
1. Tier 1 (score >= 20): GET /api/market-data
   - CoinGecko integration: BTC, ETH, MON prices
   - 60-second cache to avoid rate limits
   - Price: 0.001 USDC per call via x402
   - On success: ValidationRegistry.submitValidation() confirms the data was served

2. Tier 2 (score >= 50): GET /api/agents/discover
   - Calls AgentIdentityRegistry.discoverAgents(minTier) based on query params
   - Returns agent addresses, scores, tiers, metadata URIs (if set)
   - Price: 0.005 USDC per call via x402
   - This is the ERC-8004 agent discovery endpoint — highlight in comments

3. Tier 3 (score >= 80): POST /api/agents/coordinate
   - Accepts { recipientAgent: address, amount: uint256, memo: string }
   - Executes a real Unlink shielded transfer from the calling agent to the recipient agent
   - Both agents' reputation scores update (sender: payment made, recipient: payment received)
   - Price: 0.01 USDC per call via x402
   - This is the "holy shit" demo moment: two agents transacting privately, both building reputation

4. Gating middleware (applied to all /api/* routes)
   - Read X-Agent-Address header
   - Call APIGatekeeper.checkAccess(agentAddress, apiId) on-chain
   - If tier insufficient: return 403 with { error: true, code: "INSUFFICIENT_TIER", message: "Agent tier N required, you have tier M", requiredScore: X, currentScore: Y }
   - If tier sufficient but no x402 payment: return 402 with payment headers
   - If both pass: proceed to handler

5. Register all three APIs on-chain at server startup via APIGatekeeper.registerAPI()
</requirements>

<output>
- src/routes/api.ts (all three tiered endpoints)
- src/middleware/gating.ts (tier check + x402 combined)
- src/services/coingecko.ts (market data with cache)
- Updated server.ts with new routes mounted
</output>
```

### Exit Criteria
- [ ] Agent with score 15 gets 403 from /api/market-data with clear error message
- [ ] Same agent after 4 payments (score 20+) gets 402, pays, gets market data
- [ ] Agent with score 50+ can discover other agents via /api/agents/discover
- [ ] Agent with score 80+ can coordinate a private transfer to another agent
- [ ] All API calls logged in APIGatekeeper on-chain (call count, revenue)

---

## Phase 3 — Monad Execution Events + Real-Time (Stream 3)

### Cursor Agent Prompt

```xml
<role>Act as a frontend/full-stack developer with expertise in real-time event systems and the Monad blockchain's Execution Events SDK.</role>

<task>Integrate Monad's Execution Events SDK to stream on-chain events (score updates, tier changes, payments) to the frontend in real-time, replacing polling.</task>

<context>
Monad shipped an Execution Events SDK (Jan 2026) for ultra-low-latency on-chain event streaming. Ghost Score contracts emit events: FeedbackSubmitted, TierChanged, APICallRecorded, ValidationSubmitted, ProposalCreated, etc. Instead of polling the chain every N seconds, we subscribe to these events natively via Monad's SDK and push them to connected frontend clients via WebSocket.
This is critical for the demo: when an agent makes a payment, the dashboard should update INSTANTLY. It also shows deep Monad integration to the Monad Foundation judge.
</context>

<requirements>
1. Backend event relay (add to existing Express server)
   - Initialize Monad Execution Events SDK, subscribe to all Ghost Score contract events
   - WebSocket server (Socket.IO) alongside Express on port 3000
   - Event mapping:
     - FeedbackSubmitted → emit 'score:updated' { agent, newScore, newTier, nullifierHash }
     - TierChanged → emit 'tier:changed' { agent, oldTier, newTier }
     - APICallRecorded → emit 'api:called' { agent, apiId, timestamp }
     - ValidationSubmitted → emit 'validation:new' { agent, actionHash, success }
   - Room-based: agents join room by their address, providers join 'provider' room
   - Reconnection logic and heartbeat

2. Frontend event client (React hook)
   - useGhostScoreEvents(agentAddress) → returns { score, tier, recentEvents, connected }
   - Auto-subscribes on mount, cleans up on unmount
   - Buffers events for smooth UI updates (debounce 200ms)

3. If Monad Execution Events SDK is unavailable or undocumented:
   - Fallback: ethers.js contract.on() event listeners on the backend
   - Same WebSocket relay pattern
   - Note in code: "Preferred: Monad Execution Events SDK for sub-100ms latency"
</requirements>

<output>
- src/services/events.ts (Monad event subscription + WebSocket relay)
- src/hooks/useGhostScoreEvents.ts (React hook for frontend)
- Updated server.ts with WebSocket initialization
</output>
```

### Exit Criteria
- [ ] Backend subscribes to contract events on startup
- [ ] Frontend receives score update within 1 second of on-chain transaction
- [ ] Two browser tabs open: payment in tab 1 → score updates in tab 1, call stats update in tab 2
- [ ] Reconnection works after WebSocket disconnect

---

## Phase 4 — Frontend Dashboard (Stream 3)

### Cursor Agent Prompt

```xml
<role>Act as a senior React/TypeScript frontend developer building a hackathon demo dashboard. Prioritize visual impact, smooth animations, and clear storytelling over production polish.</role>

<task>Build the Ghost Score frontend — a 3-tab dashboard (Agent, Provider, Compliance) that demonstrates the full reputation + x402 + privacy loop with real-time updates.</task>

<context>
This dashboard IS the demo. Judges see a 3-minute presentation. Every UI element must contribute to the story: "AI agents build private reputation through x402 payments, unlocking tiered API access — a credit score without a credit report."

Backend APIs are at http://localhost:3000. Real-time events come via Socket.IO on the same port. The dashboard should work with live data AND have mock fallbacks so UI development isn't blocked.
</context>

<requirements>
1. Scaffold: Vite + React 19 + TypeScript + TailwindCSS (dark theme, clean)

2. Tab 1: Agent Dashboard
   - Wallet input field (or connect button with mock)
   - Score display: large number (0-100) with animated circular progress bar
   - Tier markers at 20, 50, 80 on the progress bar with labels (Basic, Verified, Trusted)
   - Current tier badge with color coding (gray/green/blue/gold)
   - "Make Private Payment" button → calls POST /pay via x402 flow → animates score increase in real-time
   - API Access Test section: three buttons (Market Data, Agent Discovery, Agent Coordination)
     - Each shows the result on success OR a clear "TIER LOCKED" state with required score
     - Successful call shows the response data (prices, discovered agents, transfer confirmation)
   - Activity feed: real-time log of events (payments, tier changes, API calls) streaming via WebSocket
   - Nullifier history: collapsible list of nullifier hashes with timestamps

3. Tab 2: Provider Dashboard
   - Header: "All agent identities are private" banner (prominent, on-brand)
   - Total revenue counter (animates up in real-time as x402 payments land)
   - Per-API stats cards: name, tier required, price per call, total calls, total revenue
   - Real-time call counter (ticks up when agents make API calls, via WebSocket)
   - Agent activity heatmap or simple chart (calls over time) — keep it visual

4. Tab 3: Compliance View
   - Header: "Amounts and counterparties are sealed" banner
   - Payment count (total across all agents)
   - Nullifier hash list (scrollable, with timestamps) — shows on-chain proof of activity without revealing details
   - Governance log: oracle address history, any proposals, pause events
   - Validation stats: total validated actions, success rate
   - Export button (downloads compliance report as JSON)

5. Navigation: clean tab bar at top (Agent | Provider | Compliance)

6. Mock fallbacks: if backend is offline, load realistic mock data so UI renders fully

7. Visual priorities for demo:
   - Score animation when payment lands (smooth 0→5→10→15→20 with tier unlock celebration)
   - Clear visual state change when tier unlocks (locked icon → unlocked, color shift)
   - Real-time event stream that shows activity happening live
   - "402 Payment Required" → "200 OK" transition visible in the API test section
</requirements>

<output>
Complete Vite + React project:
- src/App.tsx (tab routing)
- src/tabs/AgentDashboard.tsx
- src/tabs/ProviderDashboard.tsx
- src/tabs/ComplianceView.tsx
- src/components/ (ScoreDisplay, TierBadge, ActivityFeed, APITestCard, NullifierList, etc.)
- src/hooks/useGhostScoreEvents.ts (from Phase 3)
- src/services/api.ts (backend API calls)
- src/mocks/ (fallback data)
- tailwind.config.js (dark theme)
- index.html, vite.config.ts, package.json, tsconfig.json
</output>
```

### Exit Criteria
- [ ] All three tabs render with data (live or mocked)
- [ ] Score animates smoothly when payment lands
- [ ] Tier unlock is visually clear and satisfying
- [ ] API test buttons show 402 → pay → 200 flow
- [ ] Provider tab updates in real-time when agent makes calls
- [ ] Compliance tab shows nullifier hashes without revealing amounts

---

## Phase 5 — E2E Tests, IPFS, Demo Hardening (Stream 4)

### Cursor Agent Prompt

```xml
<role>Act as a QA engineer and DevOps specialist ensuring a hackathon project demos flawlessly under pressure.</role>

<task>Harden Ghost Score for a live 3-minute demo in front of judges. Build E2E tests, add IPFS agent metadata, pre-fund wallets, create fallbacks, and write documentation.</task>

<requirements>
1. E2E Test (demo-flow.e2e.ts)
   - Full scripted flow:
     a. Register Agent A
     b. Attempt /api/market-data → expect 403 (insufficient tier)
     c. Make 4 x402 payments via Unlink → score rises to 20+
     d. Attempt /api/market-data → expect 402 → pay → expect 200 with price data
     e. Make more payments → score rises to 50+
     f. Call /api/agents/discover → find other agents
     g. Register Agent B, build to score 80+
     h. Agent B calls /api/agents/coordinate → private transfer to Agent A
     i. Both agents' scores update
     j. Verify all on-chain state matches expectations
   - Run with: npx ts-node demo-flow.e2e.ts
   - Output: clear pass/fail per step with timing

2. IPFS Agent Metadata
   - POST /agent/metadata → accepts { name, description, capabilities[], avatar }
   - Pins to IPFS via Pinata (API key in .env)
   - Writes ipfs://Qm... URI to AgentIdentityRegistry.updateMetadata()
   - GET /agent/profile/:address resolves the IPFS URI
   - Frontend Agent Dashboard shows profile card if metadata exists

3. Wallet Pre-Funding Script (prefund.ts)
   - Funds all demo wallets with MON (from faucet or pre-funded deployer)
   - Funds with testnet USDC/USDT from Unlink faucet
   - Deposits into Unlink shielded pool
   - Run before demo: npx ts-node prefund.ts

4. Balance Report (balance-report.ts)
   - Checks MON, USDC balances across: deployer, oracle, agent A, agent B, middleware signer
   - Checks Unlink shielded balances
   - Prints table: "All wallets funded ✓" or specific warnings

5. Demo Fallback Data
   - If any RPC call fails during demo, serve cached/mock data instead of crashing
   - Frontend mock mode toggle via env var
   - Backend graceful degradation: log error, return last-known-good data

6. Documentation
   - README.md: project overview, architecture diagram, how to run
   - SETUP.md: step-by-step local dev setup with all env vars
   - FLOW.md: the end-to-end sequence diagram
   - SECURITY.md: trust assumptions (oracle privilege, nullifier guarantees, governance path)

7. Run E2E test 5+ times successfully before submission
</requirements>

<output>
- scripts/demo-flow.e2e.ts
- scripts/prefund.ts
- scripts/balance-report.ts
- src/routes/metadata.ts (IPFS endpoints)
- docs/README.md, SETUP.md, FLOW.md, SECURITY.md
- .env.example with all variables documented
</output>
```

### Exit Criteria
- [ ] E2E test passes 5 consecutive runs
- [ ] All demo wallets funded and verified
- [ ] IPFS metadata pinned and resolvable
- [ ] Frontend renders agent profile cards from IPFS
- [ ] Fallback mode works when backend is offline
- [ ] All docs written

---

## Phase 6 — Governance + Rate Limiting (Stream 4, parallel)

### Cursor Agent Prompt

```xml
<role>Act as a security-focused Solidity and backend developer hardening a system for production-readiness demonstration.</role>

<task>Implement lightweight governance for oracle rotation and per-agent rate limiting for API protection. These demonstrate production thinking to judges without requiring full infrastructure.</task>

<requirements>
1. Governance (already deployed in Phase 0)
   - Wire up frontend Compliance tab to display:
     - Current oracle address
     - Proposal history (if any)
     - Governance signers
   - Backend endpoint: GET /governance/status → returns oracle, signers, proposals, pause state
   - Demo moment: show that no single admin can change the oracle unilaterally

2. Rate Limiting
   - In-memory sliding window rate limiter (no Redis needed for hackathon)
   - Per-agent, per-API: provider sets maxCallsPerMinute when registering API
   - Rate limit headers: X-RateLimit-Remaining, X-RateLimit-Reset
   - 429 Too Many Requests with clear error when exceeded
   - Provider Dashboard: rate limit config display + abuse alert indicator
   - Agent Dashboard: remaining quota per API

3. Provider Auth
   - POST /provider/register → returns API key
   - X-Provider-Key header required for provider management endpoints
   - API key stored hashed in memory (or on-chain if time permits)
</requirements>

<output>
- src/middleware/rateLimit.ts
- src/routes/governance.ts
- Updated provider routes with auth
- Updated frontend tabs with governance log + rate limit display
</output>
```

### Exit Criteria
- [ ] Governance status visible in Compliance tab
- [ ] Rate limiting active: 11th call in 1 minute returns 429
- [ ] Rate limit headers present in all gated API responses
- [ ] Provider auth works with API key

---

## Phase 7 — Submission Prep & Pitch (All Streams Converge)

### Pitch Script (3 min + 3 min Q&A)

| Time | Slide/Action | Script |
|---|---|---|
| 0:00-0:20 | Problem slide | "AI agents are becoming economic actors — they pay for APIs, hire other agents, manage treasuries. But they can't build trust. Public blockchains expose everything. No agent will put its entire financial history on a public ledger. The agentic economy needs credit infrastructure." |
| 0:20-0:40 | Solution slide | "Ghost Score is the credit bureau for the agentic economy. Agents build verifiable reputation through ZK-shielded payments — a credit score without a credit report. Every x402 API payment simultaneously pays for access, builds reputation, and stays private." |
| 0:40-1:00 | Architecture slide | "We implement the full ERC-8004 standard — Identity, Reputation, and Validation registries — on Monad. Payments flow through Unlink's privacy layer. Real-time score updates via Monad Execution Events. One action, three outcomes." |
| 1:00-2:30 | LIVE DEMO | Register Agent A → Show score at 0, all APIs locked → Make 4 private payments (score animates 0→20+) → Tier 1 unlocks, celebration animation → Hit market data API, get prices → Show Provider tab (revenue ticking up, agent identity hidden) → Quick flash of Compliance tab (nullifier hashes, no amounts visible) → If time: show Agent B discovering Agent A via Tier 2 |
| 2:30-3:00 | Why Now slide | "ERC-8004 launched 4 weeks ago. x402 is live. Unlink makes privacy default. Monad makes it fast. Every piece of this stack exists TODAY. Ghost Score is the credit layer that connects them." |

### Q&A Prep (Anticipated Questions)

| Judge | Likely Question | Answer |
|---|---|---|
| Sean C (Aztec) | "Why should I trust your oracle? It can inflate scores." | "Today, the oracle submits Unlink nullifier hashes as cryptographic proof a payment occurred. The contract verifies uniqueness. Amount weighting is the remaining trust assumption — our governance module requires 2-of-3 multisig to rotate the oracle. The path to full trustlessness is generating a ZK proof of the payment amount inside the shielded pool, which we'd build on Aztec's Noir." |
| Jonah (BC) | "What's the business model?" | "Providers pay to register APIs. Agents pay per call via x402. Ghost Score takes a protocol fee on each x402 settlement. Revenue scales with agentic transaction volume — every new agent and API increases the network." |
| Jason (EF) | "How closely does this follow ERC-8004?" | "We implement all three registries: Identity for agent profiles and discovery, Reputation for multi-factor scoring, and Validation for provider-confirmed action proofs. We diverge on the scoring algorithm — ERC-8004 is unopinionated on scoring, we use a weighted multi-factor model." |
| Fitz (Monad) | "Why Monad specifically?" | "Sub-second finality means reputation updates confirm before the agent's next API call. On a 12-second block time chain, an agent would have to wait between payments. On Monad, the score updates are real-time — we show that live in the demo via Monad Execution Events SDK." |
| Iqram (Venmo) | "Would agents actually use this?" | "Same question people asked about credit scores in the 1950s. Any time autonomous actors transact, they need trust signals. Ghost Score is the FICO for machines — and unlike FICO, it preserves privacy by default." |

### DoraHacks Submission Checklist
- [ ] Project title: Ghost Score
- [ ] One-liner: "The credit bureau for the agentic economy"
- [ ] Description: Full architecture + privacy thesis + ERC-8004 + x402 integration
- [ ] GitHub repo: public, clean README, all code committed
- [ ] Demo video: 2-min screen recording of the E2E flow (backup if live demo fails)
- [ ] Screenshots: Agent Dashboard, Provider Dashboard, Compliance View
- [ ] Track selection: x402 Agents (primary), also eligible for Best Use of Unlink SDK
- [ ] Team members listed

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Unlink SDK docs are sparse / breaking changes | Medium | High | Read source code directly. Ask @phklive in Telegram immediately. Have the Unlink mentor review your integration Saturday. |
| Monad testnet RPC instability | Low | High | Cache last-known-good data. Frontend mock fallback mode. Multiple RPC endpoints in config. |
| x402 SDK integration issues | Medium | Medium | Minimal x402 implementation: just HTTP 402 response with payment headers + manual verification. Don't over-engineer the x402 layer. |
| Monad Execution Events SDK unavailable | Medium | Medium | Fallback to ethers.js contract.on() event listeners. Same WebSocket relay pattern. Note in code that Execution Events is preferred. |
| Demo wallet runs out of testnet tokens | Low | Critical | Pre-fund generously. balance-report.ts before demo. Faucet URLs bookmarked. |
| Live demo crashes | Low | Critical | Pre-recorded backup video. Mock fallback mode in frontend. E2E test IS the demo script. |
| Another team builds similar concept | Medium | Medium | Full ERC-8004 (3 registries) is our moat. No other team will implement Validation Registry. Agent-to-agent coordination via Tier 3 is unique. |

---

## Success Metrics

| Metric | Target |
|---|---|
| Contracts deployed | 5/5 on Monad testnet |
| E2E test pass rate | 100% (5 consecutive) |
| Demo duration | ≤ 3:00 |
| API endpoints working | 6+ (3 tiered + registration + score + discovery) |
| Real-time event latency | < 2 seconds from tx to UI update |
| Judge Q&A prep | 5/5 judges covered |
| DoraHacks submission | Complete before 12:00 PM Sunday |
