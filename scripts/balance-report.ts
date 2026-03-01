/*
  Check all wallet balances across the Ghost Score system
  Run: cd scripts && npx tsx balance-report.ts

  Reads .env from project root for RPC URL.
  Prints a formatted table with warnings for low balances.
*/

import { ethers } from "ethers";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

const RPC = process.env.MONAD_RPC_URL;
if (!RPC) {
  console.error("MONAD_RPC_URL not set in .env");
  process.exit(1);
}

const WALLETS = [
  { name: "Deployer", address: "0x5720dBD6C2135b9C1B06d32B4D3C22084238feb7" },
  { name: "Oracle", address: process.env.ORACLE_ADDRESS || "0x8dC3ac499099C62FD20dB1f67b0b695EE2712c7B" },
];

const LOW_THRESHOLD = ethers.parseEther("0.1");

async function main() {
  console.log("\n\uD83D\uDCCA Ghost Score Balance Report\n");

  const provider = new ethers.JsonRpcProvider(RPC);

  let networkName: string;
  let chainId: bigint;
  try {
    const network = await provider.getNetwork();
    networkName = network.name;
    chainId = network.chainId;
  } catch {
    networkName = "unknown";
    chainId = 0n;
  }
  console.log(`  Network: ${networkName} (Chain ID: ${chainId})\n`);

  const sep = "-".repeat(58);
  console.log(`  ${sep}`);
  console.log(`  ${"Wallet".padEnd(20)} ${"Address".padEnd(14)} ${"MON Balance".padStart(18)}  St`);
  console.log(`  ${sep}`);

  let allGood = true;

  for (const w of WALLETS) {
    try {
      const bal = await provider.getBalance(w.address);
      const formatted = parseFloat(ethers.formatEther(bal)).toFixed(4);
      const short = w.address.slice(0, 6) + "..." + w.address.slice(-4);
      const ok = bal >= LOW_THRESHOLD;
      if (!ok) allGood = false;
      const icon = ok ? "\u2705" : "\u26A0\uFE0F";
      console.log(`  ${w.name.padEnd(20)} ${short.padEnd(14)} ${formatted.padStart(18)}  ${icon}`);
    } catch (err: any) {
      console.log(`  ${w.name.padEnd(20)} ${"ERROR".padEnd(14)} ${"--".padStart(18)}  \u274C`);
      allGood = false;
    }
  }

  console.log(`  ${sep}`);
  console.log(
    allGood
      ? "\n  \u2705 All wallets funded \u2014 ready for demo\n"
      : "\n  \u26A0\uFE0F  Some wallets are low \u2014 run prefund.ts\n"
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
