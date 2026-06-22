import BlockchainService from '../../blockchain/blockchain.service';
import config from '../../config';
import logger from '../../utils/logger';

export class AccountService {
  static async getBalance(walletAddress: string, tokenAddress: string = config.USDC_ADDRESS, chainId: number = config.HOODI_CHAIN_ID) {
    const userWallet = walletAddress.toLowerCase();
    const token = tokenAddress.toLowerCase();

    // Call blockchain service parallelly for efficiency
    const [unifiedBalance, uncommittedBalance, committedBalances, subAccountIds] = await Promise.all([
      BlockchainService.SXUAService.getUnifiedBalance(userWallet, token, chainId),
      BlockchainService.SXUAService.getUncommittedBalance(userWallet, token, chainId),
      BlockchainService.SXUAService.getCommittedBalances(userWallet, token, chainId),
      BlockchainService.SXUAService.getUserSubAccounts(userWallet, chainId),
    ]);

    // Sum accrued yield from all sub-accounts
    let accruedYield = 0n;
    if (subAccountIds && subAccountIds.length > 0) {
      const yieldPromises = subAccountIds.map((id) =>
        BlockchainService.SXUAService.getAccruedYield(userWallet, Number(id), chainId).catch(() => 0n)
      );
      const yields = await Promise.all(yieldPromises);
      accruedYield = yields.reduce((acc, val) => acc + val, 0n);
    }

    return {
      unifiedBalance: unifiedBalance.toString(),
      committedBalances: committedBalances.toString(),
      uncommittedBalance: uncommittedBalance.toString(),
      accruedYield: accruedYield.toString(),
    };
  }

  static getDepositPayload(tokenAddress: string = config.USDC_ADDRESS, amount: string, committedPercentage: number) {
    return {
      contractAddress: config.SXUA_ADDRESS,
      method: 'deposit',
      args: [tokenAddress, amount, committedPercentage],
      description: `Deposit ${amount} tokens with ${committedPercentage}% committed.`,
    };
  }

  static getWithdrawPayload(tokenAddress: string = config.USDC_ADDRESS, amount: string, isCommitted: boolean, subAccountId?: number) {
    if (isCommitted) {
      if (subAccountId === undefined) {
        throw new Error('subAccountId is required for committed withdrawal');
      }
      return {
        contractAddress: config.SXUA_ADDRESS,
        method: 'withdrawCommitted',
        args: [subAccountId],
        description: `Withdraw from committed sub-account ${subAccountId}`,
      };
    } else {
      return {
        contractAddress: config.SXUA_ADDRESS,
        method: 'withdrawUncommitted',
        args: [tokenAddress, amount],
        description: `Withdraw ${amount} uncommitted tokens`,
      };
    }
  }
}
