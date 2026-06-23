import { ethers, upgrades } from "hardhat";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const sxuaAddress = process.env.SXUA_ADDRESS;
  if (!sxuaAddress) {
    throw new Error("SXUA_ADDRESS is not set in .env");
  }

  console.log(`Upgrading SXUAUpgradeable proxy at: ${sxuaAddress}`);

  const SXUAFactory = await ethers.getContractFactory("SXUAUpgradeable");
  // This will validate the implementation, deploy it, and update the proxy slot
  const upgraded = await upgrades.upgradeProxy(sxuaAddress, SXUAFactory);
  await upgraded.waitForDeployment();

  console.log(`SXUAUpgradeable successfully upgraded at address: ${await upgraded.getAddress()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
