import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { ethers, networkName } = await hre.network.connect();
const [deployer] = await ethers.getSigners();
const deployerAddr = await deployer.getAddress();
const oracleAddress = process.env.ORACLE_ADDRESS || deployerAddr;

console.log(`Deploying to ${networkName} with account: ${deployerAddr}`);
console.log(
  "Balance:",
  (await ethers.provider.getBalance(deployerAddr)).toString()
);

// 1. ReputationRegistry
console.log("\n1/5 Deploying ReputationRegistry...");
const reputationRegistry = await ethers.deployContract("ReputationRegistry", [
  deployerAddr,
]);
await reputationRegistry.waitForDeployment();
const repAddr = await reputationRegistry.getAddress();
console.log("   ReputationRegistry:", repAddr);

// 2. AgentIdentityRegistry
console.log("2/5 Deploying AgentIdentityRegistry...");
const agentIdentityRegistry = await ethers.deployContract(
  "AgentIdentityRegistry"
);
await agentIdentityRegistry.waitForDeployment();
const agentAddr = await agentIdentityRegistry.getAddress();
console.log("   AgentIdentityRegistry:", agentAddr);

// 3. ValidationRegistry
console.log("3/5 Deploying ValidationRegistry...");
const validationRegistry = await ethers.deployContract("ValidationRegistry", [
  deployerAddr,
]);
await validationRegistry.waitForDeployment();
const valAddr = await validationRegistry.getAddress();
console.log("   ValidationRegistry:", valAddr);

// 4. APIGatekeeper
console.log("4/5 Deploying APIGatekeeper...");
const apiGatekeeper = await ethers.deployContract("APIGatekeeper", [repAddr]);
await apiGatekeeper.waitForDeployment();
const apiAddr = await apiGatekeeper.getAddress();
console.log("   APIGatekeeper:", apiAddr);

// 5. Governance (60s timelock for demo)
console.log("5/5 Deploying Governance...");
const governance = await ethers.deployContract("Governance", [
  repAddr,
  [deployerAddr, deployerAddr, deployerAddr],
  60,
]);
await governance.waitForDeployment();
const govAddr = await governance.getAddress();
console.log("   Governance:", govAddr);

// Set oracle
console.log(`\nSetting oracle to: ${oracleAddress}`);
const tx = await reputationRegistry.setOracle(oracleAddress);
await tx.wait();
console.log("   Oracle set.");

// Write deployed addresses
const net = await ethers.provider.getNetwork();
const addresses = {
  AgentIdentityRegistry: agentAddr,
  ReputationRegistry: repAddr,
  ValidationRegistry: valAddr,
  APIGatekeeper: apiAddr,
  Governance: govAddr,
  network: networkName,
  chainId: Number(net.chainId),
  deployer: deployerAddr,
  oracle: oracleAddress,
  timestamp: new Date().toISOString(),
};

const outPath = path.join(__dirname, "..", "deployed-addresses.json");
fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
console.log("\nAddresses written to deployed-addresses.json");

console.log("\n--- Copy to .env ---");
console.log(`AGENT_IDENTITY_REGISTRY=${agentAddr}`);
console.log(`REPUTATION_REGISTRY=${repAddr}`);
console.log(`VALIDATION_REGISTRY=${valAddr}`);
console.log(`API_GATEKEEPER=${apiAddr}`);
console.log(`GOVERNANCE=${govAddr}`);
console.log("\nDeployment complete!");
