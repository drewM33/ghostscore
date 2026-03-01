
# 👻 GhostScore

### Zero-knowledge credit scores for the emerging ERC-8004 agentic economy.

**Built in ~24 hours at [Ship Private. Ship Fast.](https://hackathon.unlink.xyz) — Unlink × Monad Hackathon (NYC, 2026)**

[Demo Video](https://vimeo.com/YOUR_LINK) · [Live App](https://ghostscore-app.onrender.com) · [Submission](https://hackathon.unlink.xyz)

---

</div>

## The Problem

On-chain reputation systems today force AI agents into an impossible tradeoff:

- **Be transparent and trusted** — expose your wallet address, full transaction history, and every API call you've ever made. Anyone can deanonymize you for [under $4 with 90% accuracy](https://protos.com/ai-agents-want-to-identify-your-crypto-wallet-using-social-media/).
- **Be private and invisible** — use fresh wallets or mixers, but then no provider trusts you. You can't access gated APIs, coordination endpoints, or premium services.

Existing reputation systems were designed for humans, not for high-frequency ERC-8004 agents making hundreds of API calls per session. They expose wallet addresses and full histories. They're fragile to Sybil attacks and airdrop farming. There is no way for an agent to prove *"I'm trustworthy"* without also proving *"I'm wallet 0xABC."*

**GhostScore eliminates this tradeoff.**

## How It Works

```
Agent calls paid API → x402 micropayment triggers → Payment routes through Unlink shielded pool
→ Reputation accrues on-chain → Agent proves tier via ZK attestation → No identity revealed
```

1. **AI agents discover API endpoints** registered on-chain via the GhostScore marketplace.
2. **Agents pay per-request via x402** — the HTTP-native micropayment standard. No accounts, no API keys, no human approval.
3. **Every payment routes through Unlink's shielded transfer system**, breaking the on-chain link between payer and payee.
4. **Reputation points accrue on-chain** in the ReputationRegistry smart contract. Real, immutable, earned — not self-reported.
5. **Tiered access gates** (Tier 0–3) control which endpoints agents can call, enforced by smart contracts on Monad.
6. **Zero-knowledge attestations** let agents prove "I'm Tier 2+" without revealing their score, wallet address, or transaction history.

Providers get **trust**. Agents keep **privacy**. Nobody does KYC.

## Why Unlink Is the Core Primitive

Unlink is not a bolt-on privacy feature — it is the architectural foundation that makes GhostScore possible.

Every x402 micropayment between an agent and an API provider routes through **Unlink's shielded transfer system** on Monad. GhostScore's contracts verify that a valid payment occurred, but the public chain cannot see:

- ❌ Which agent paid
- ❌ Which endpoint they called
- ❌ How much they paid

This unlocks two capabilities that did not exist before:

### Private, Earned Reputation
Reputation points are backed by *real paid activity*, not self-claimed trust scores. Yet those payments are completely unlinkable on-chain. With normal ERC-20 transfers, the transaction graph deanonymizes you. With Unlink, it can't.

### Privacy as an Access Primitive
Providers can gate high-value endpoints behind reputation tiers earned exclusively through shielded flows. DAOs and infrastructure teams can enforce policies like *"only coordinate with agents whose reputation was earned via shielded payments."* This is configurable, compliant privacy — not just a toggle.

> **"Unlink turns private payments into a signal instead of a liability — GhostScore harvests that signal to build zero-knowledge credit scores for agents."**

## Why This Wasn't Possible Before This Hackathon

GhostScore required three primitives that have never co-existed until this weekend:

| Primitive | What It Enables |
|---|---|
| **Unlink** | Production-ready shielded transfers on Monad, simple enough to wire into x402 payment flows in a weekend |
| **Monad** | High-throughput parallel EVM with sub-second finality — reputation updates in real-time for agents calling endpoints dozens of times per minute |
| **x402** | HTTP-native, per-request micropayments — the missing glue between APIs, agents, and on-chain billing |

Before this:
- Private payments lived on separate privacy chains or clunky mixers — not where agents actually pay for APIs.
- On-chain reputation meant doxxed wallets or fragile off-chain scoring.
- x402 endpoints weren't wired into a privacy-preserving, on-chain reputation layer.

**GhostScore is only possible because this hackathon put Unlink, Monad, and x402 in the same room.**

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                  │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Wallet   │  │  Dashboard   │  │  API Marketplace  │  │
│  │  Connect  │  │  Score/Tier  │  │  5 Endpoints      │  │
│  └──────────┘  └──────────────┘  └───────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ WebSocket + REST
┌────────────────────────▼────────────────────────────────┐
│                Backend (Express + Socket.IO)              │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  x402     │  │  Score       │  │  ZK Attestation   │  │
│  │  Gateway  │  │  Engine      │  │  Generator        │  │
│  └─────┬────┘  └──────┬───────┘  └───────────────────┘  │
└────────┼───────────────┼────────────────────────────────┘
         │               │
┌────────▼───────────────▼────────────────────────────────┐
│                    Monad (EVM)                            │
│  ┌──────────────┐  ┌────────────────┐  ┌─────────────┐  │
│  │ Reputation   │  │ Agent Identity │  │   USDC       │  │
│  │ Registry     │  │ Registry       │  │   Contract   │  │
│  │ (ERC-8004)   │  │ (ERC-8004)     │  │              │  │
│  └──────────────┘  └────────────────┘  └──────┬──────┘  │
└───────────────────────────────────────────────┼─────────┘
                                                │
┌───────────────────────────────────────────────▼─────────┐
│                  Unlink Shielded Pool                     │
│         Private settlement of all x402 payments           │
│         Sender, receiver, and amount concealed            │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint | Tier | Price (USDC) | Description |
|---|---|---|---|
| Market Data | 1 | 0.001 | Zero-knowledge relay for private transaction routing across L2 bridges |
| Agent Discovery (ERC-8004) | 2 | 0.005 | High-frequency oracle endpoint for real-time price feeds with MEV protection |
| Agent Coordination | 3 | 0.01 | Vault-secured coordination protocol for trusted multi-agent task execution |
| Shielded Transfer Relay | 1 | 0.002 | Execute a real shielded transfer through Unlink to any address |
| ZK Identity Attestation | 2 | 0.008 | On-chain score and tier verification with signed attestation |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, TypeScript, Tailwind CSS |
| Backend | Express, Socket.IO, ethers.js |
| Blockchain | Monad (EVM), Solidity |
| Privacy | Unlink SDK (shielded transfers) |
| Payments | x402 (HTTP 402 Payment Required) |
| Agent Standard | ERC-8004 (Identity + Reputation Registries) |
| Deployment | Render |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm
- MetaMask wallet with Monad testnet configured

### Installation

```bash
git clone https://github.com/drewM33/ghostscore.git
cd ghostscore

# Install dependencies
pnpm install

# Set environment variables
cp .env.example .env
# Fill in: PRIVATE_KEY, RPC_URL, contract addresses

# Run the backend
cd server
pnpm dev

# Run the frontend (new terminal)
cd ..
pnpm dev
```

### Environment Variables

```
PRIVATE_KEY=           # Server wallet private key
RPC_URL=               # Monad RPC endpoint
USDC_ADDRESS=          # USDC contract on Monad
REPUTATION_REGISTRY=   # ReputationRegistry contract address
AGENT_IDENTITY_REGISTRY= # AgentIdentityRegistry contract address
```

## Demo Flow

1. **Connect wallet** on the GhostScore dashboard
2. **Browse the API marketplace** — 5 endpoints across 4 tiers
3. **Call a Tier 1 endpoint** — x402 payment fires, reputation score increases in real-time via WebSocket
4. **Call the Shielded Transfer Relay** — payment routes through Unlink, score updates
5. **Call ZK Identity Attestation** — receive a signed proof of your tier without revealing your address
6. **Cross the Tier 2 threshold (50 points)** — watch the ghost mascot power-up animation 👻⚡
7. **Access higher-tier endpoints** — previously locked APIs are now available

## Market Context

| Metric | Value |
|---|---|
| Autonomous AI agent market (2030) | $48.3B at 43.3% CAGR |
| AI wallet deanonymization cost | <$4 per attempt, 90% accuracy |
| ZK proof market (2033) | $7.59B |
| Agentic commerce (2030) | $3–5T globally |

Sources: Yahoo Finance, ETH Zurich/Anthropic, Grand View Research, McKinsey

## Team

**Nullifier Labs** — [Drew Mailen](https://github.com/drewM33)

Built solo in ~24 hours at Ship Private. Ship Fast. (NYC, Feb 27 – Mar 1, 2026)

## License

[MIT](LICENSE)
