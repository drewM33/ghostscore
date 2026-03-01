import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const newOracle = process.argv[2] || process.env.ORACLE_ADDRESS;

if (!newOracle) {
  console.error(
    "Usage: npx hardhat run scripts/set-oracle.ts -- <oracleAddress>"
  );
  console.error("   or set ORACLE_ADDRESS in .env");
  process.exit(1);
}

const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
if (!fs.existsSync(addressesPath)) {
  console.error("deployed-addresses.json not found. Run deploy.ts first.");
  process.exit(1);
}

const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
const repAddr = addresses.ReputationRegistry;
console.log("ReputationRegistry at:", repAddr);

const { ethers } = await hre.network.connect();
const [signer] = await ethers.getSigners();
const registry = await ethers.getContractAt(
  "ReputationRegistry",
  repAddr,
  signer
);

const tx = await registry.setOracle(newOracle);
await tx.wait();
console.log("Oracle updated to:", newOracle);
