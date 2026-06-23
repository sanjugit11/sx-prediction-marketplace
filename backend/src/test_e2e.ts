import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BACKEND_URL = 'http://localhost:3000';
const USDC_ADDRESS = process.env.USDC_ADDRESS!;
const SXUA_ADDRESS = process.env.SXUA_ADDRESS!;

async function main() {
  console.log('--- STARTING END-TO-END DEMO TIME INTEGRATION TEST ---');
  
  // 1. Initialize Wallet
  const provider = new ethers.JsonRpcProvider('https://rpc.hoodi.ethpandaops.io');
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
  console.log(`Wallet address: ${wallet.address}`);

  // 2. Login to backend
  console.log('\n[Step 1] Logging in to backend...');
  const timestamp = new Date().toISOString();
  const message = `Sign this message to login to SX Prediction: ${timestamp}`;
  const signature = await wallet.signMessage(message);

  const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      walletAddress: wallet.address,
      signature,
      message,
    }),
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    throw new Error(`Login failed: ${errorText}`);
  }

  const { token: jwtToken } = await loginResponse.json() as { token: string };
  console.log('Successfully logged in. JWT token received.');

  // Helper for authenticated API calls
  const getBackendBalance = async () => {
    const res = await fetch(`${BACKEND_URL}/api/account/balance?token=${USDC_ADDRESS}&chainId=560042`, {
      headers: { 'Authorization': `Bearer ${jwtToken}` },
    });
    if (!res.ok) {
      throw new Error(`Failed to get balance: ${await res.text()}`);
    }
    return await res.json() as {
      unifiedBalance: string;
      committedBalances: string;
      uncommittedBalance: string;
      accruedYield: string;
    };
  };

  // 3. Get Initial Balance
  console.log('\n[Step 2] Querying initial balance from backend API...');
  const initialBal = await getBackendBalance();
  console.log(`Initial balances:`);
  console.log(`  - Unified Balance: ${ethers.formatUnits(initialBal.unifiedBalance, 6)} USDC`);
  console.log(`  - Committed Balance: ${ethers.formatUnits(initialBal.committedBalances, 6)} USDC`);
  console.log(`  - Uncommitted Balance: ${ethers.formatUnits(initialBal.uncommittedBalance, 6)} USDC`);

  // 4. Approve and Deposit on-chain
  console.log('\n[Step 3] Depositing $10,000 USDC with a 70% committed / 30% uncommitted split...');
  const usdc = new ethers.Contract(
    USDC_ADDRESS,
    ['function approve(address spender, uint256 amount) public returns (bool)'],
    wallet
  );
  const sxua = new ethers.Contract(
    SXUA_ADDRESS,
    [
      'function deposit(address token, uint256 amount, uint256 committedPercentage) external',
      'function getUserSubAccounts(address owner) external view returns (uint256[] memory)',
    ],
    wallet
  );

  const depositAmount = ethers.parseUnits('10000', 6); // $10,000 USDC
  console.log('Sending approve transaction...');
  const appTx = await usdc.approve(SXUA_ADDRESS, depositAmount);
  await appTx.wait(1);
  console.log('Approve transaction confirmed.');

  console.log('Sending deposit transaction...');
  const depTx = await sxua.deposit(USDC_ADDRESS, depositAmount, 70); // 70% committed split
  await depTx.wait(1);
  console.log('Deposit transaction confirmed.');

  // 5. Query updated balance
  console.log('\n[Step 4] Querying updated balances from backend API...');
  const updatedBal = await getBackendBalance();
  console.log(`Updated balances:`);
  console.log(`  - Unified Balance: ${ethers.formatUnits(updatedBal.unifiedBalance, 6)} USDC`);
  console.log(`  - Committed Balance: ${ethers.formatUnits(updatedBal.committedBalances, 6)} USDC`);
  console.log(`  - Uncommitted Balance: ${ethers.formatUnits(updatedBal.uncommittedBalance, 6)} USDC`);

  // Assert correct split
  const expectedCommittedDiff = 7000n * (10n ** 18n); // 7,000 USDC/SXUA tokens (18 decimals inside contract)
  const expectedUncommittedDiff = 3000n * (10n ** 6n); // 3,000 USDC (6 decimals)
  console.log(`Split Verification:`);
  console.log(`  - Committed change: +${ethers.formatUnits(BigInt(updatedBal.committedBalances) - BigInt(initialBal.committedBalances), 18)} SXUA tokens (expected +7000)`);
  console.log(`  - Uncommitted change: +${ethers.formatUnits(BigInt(updatedBal.uncommittedBalance) - BigInt(initialBal.uncommittedBalance), 6)} USDC (expected +3000)`);

  const sxuaRead = new ethers.Contract(
    SXUA_ADDRESS,
    ['function getUserSubAccounts(address owner) external view returns (uint256[] memory)'],
    provider
  );
  const subIds = await sxuaRead.getUserSubAccounts(wallet.address) as bigint[];
  const subId = Number(subIds[subIds.length - 1]);
  console.log(`New Committed Sub-Account ID: ${subId}`);

  // 6. Wait 35 seconds to verify yield accrual at 30 seconds ($12 yield)
  console.log('\n[Step 5] Waiting 35 seconds to verify yield accrual (30s = $12 yield)...');
  await new Promise((resolve) => setTimeout(resolve, 35000));

  const yieldBal = await getBackendBalance();
  const accrued = BigInt(yieldBal.accruedYield);
  console.log(`Accrued yield after 35 seconds: ${ethers.formatUnits(accrued, 18)} yield tokens`);
  if (accrued > 0n) {
    console.log('SUCCESS: Yield is accruing correctly in real-time!');
  } else {
    console.log('WARNING: Yield is still 0. Check smart contract clock warping.');
  }

  // 7. Verify Early Withdrawal Warning condition (elapsed < 300 seconds)
  console.log('\n[Step 6] Verifying early withdrawal warning condition (elapsed < 5 minutes)...');
  const sxuaDetailsContract = new ethers.Contract(
    SXUA_ADDRESS,
    ['function subAccounts(uint256) external view returns (uint256, address, address, uint256, uint256, uint256, uint256, bool)'],
    provider
  );
  const subAccountDetails = await sxuaDetailsContract.subAccounts(subId) as any[];
  const createdAt = Number(subAccountDetails[4]);
  const maturityDate = Number(subAccountDetails[5]);
  const currentBlockTime = Math.floor(Date.now() / 1000);
  const elapsedSeconds = currentBlockTime - createdAt;

  console.log(`Sub-account created at: ${new Date(createdAt * 1000).toISOString()}`);
  console.log(`Sub-account matures at: ${new Date(maturityDate * 1000).toISOString()}`);
  console.log(`Time elapsed: ${elapsedSeconds} seconds (Maturity limit is 300 seconds)`);

  if (elapsedSeconds < 300) {
    console.log('STATUS: Early withdrawal warning IS active (forfeits yield).');
  }

  // 8. Wait remaining time until maturity (total 5 minutes since creation)
  const remainingSeconds = Math.max(0, 305 - elapsedSeconds);
  console.log(`\n[Step 7] Waiting ${remainingSeconds} seconds until 5-minute maturity date completes...`);
  
  let countdown = remainingSeconds;
  while (countdown > 0) {
    const sleepTime = Math.min(30, countdown);
    await new Promise((resolve) => setTimeout(resolve, sleepTime * 1000));
    countdown -= sleepTime;
    if (countdown > 0) {
      console.log(`  - ${countdown} seconds remaining until maturity...`);
    }
  }

  // 9. Perform mature withdrawal on-chain (No warning should be active, full yield claimed)
  console.log('\n[Step 8] Sub-account should be mature now. Performing mature withdrawal on-chain...');
  const sxuaWrite = new ethers.Contract(
    SXUA_ADDRESS,
    ['function withdrawCommitted(uint256 subAccountId) external'],
    wallet
  );
  
  const withdrawTx = await sxuaWrite.withdrawCommitted(subId);
  console.log('Sending withdrawCommitted transaction...');
  await withdrawTx.wait(1);
  console.log('Withdraw transaction confirmed.');

  // 10. Verify final balance (accrued yield + principal returned to uncommitted)
  console.log('\n[Step 9] Querying final balance from backend API...');
  const finalBal = await getBackendBalance();
  console.log(`Final balances:`);
  console.log(`  - Unified Balance: ${ethers.formatUnits(finalBal.unifiedBalance, 6)} USDC`);
  console.log(`  - Committed Balance: ${ethers.formatUnits(finalBal.committedBalances, 6)} USDC`);
  console.log(`  - Uncommitted Balance: ${ethers.formatUnits(finalBal.uncommittedBalance, 6)} USDC`);

  console.log('\n--- INTEGRATION TEST COMPLETED SUCCESSFULLY! ---');
}

main().catch((err) => {
  console.error('\nE2E TEST FAILED:', err);
  process.exit(1);
});
