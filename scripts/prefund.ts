/*
  Pre-fund demo wallets with MON
  Run: cd scripts && npx tsx prefund.ts

  Reads .env from project root for RPC URL and deployer key.
  Checks each wallet's balance and tops up if below threshold.
*/

import { ethers } from "ethers";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

const RPC = process.env.MONAD_RPC_URL;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

if (!RPC) {
  console.error("MONAD_RPC_URL not set in .env");
  process.exit(1);
}
if (!DEPLOYER_KEY) {
  console.error("DEPLOYER_PRIVATE_KEY not set in .env");
  process.exit(1);
}

const WALLETS_TO_FUND = [
  { name: "Oracle", address: process.env.ORACLE_ADDRESS || "0x8dC3ac499099C62FD20dB1f67b0b695EE2712c7B" },
  { name: "Backend Signer", address: "0x5720dBD6C2135b9C1B06d32B4D3C22084238feb7" },
];

const MIN_MON = ethers.parseEther("0.5");
const FUND_AMOUNT = ethers.parseEther("1.0");

async function main() {
  console.log("\n\uD83D\uDCB0 Ghost Score Wallet Pre-Funder\n");

  const provider = new ethers.JsonRpcProvider(RPC);
  const deployer = new ethers.Wallet(DEPLOYER_KEY!, provider);

  console.log(`  Deployer: ${deployer.address}`);
  const deployerBal = await provider.getBalance(deployer.address);
  console.log(`  Deployer MON: ${ethers.formatEther(deployerBal)}\n`);

  if (deployerBal < FUND_AMOUNT) {
    console.log("  \u26A0\uFE0F  Deployer balance too low to fund wallets.");
    console.log("  Get testnet MON from https://faucet.monad.xyz\n");
    process.exit(1);
  }

  for (const w of WALLETS_TO_FUND) {
    const bal = await provider.getBalance(w.address);
    console.log(`  ${w.name} (${w.address.slice(0, 10)}...): ${ethers.formatEther(bal)} MON`);

    if (bal < MIN_MON) {
      console.log(`    \u26A0\uFE0F  Low balance \u2014 sending ${ethers.formatEther(FUND_AMOUNT)} MON...`);
      try {
        const tx = await deployer.sendTransaction({ to: w.address, value: FUND_AMOUNT });
        await tx.wait();
        console.log(`    \u2705 Funded. Tx: ${tx.hash}`);
      } catch (err: any) {
        console.log(`    \u274C Failed: ${err.message}`);
      }
    } else {
      console.log(`    \u2705 Sufficient`);
    }
  }

  console.log("\n  Done. Run balance-report.ts to verify.\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
