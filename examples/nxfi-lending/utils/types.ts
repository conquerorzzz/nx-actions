import { AnchorProvider, BN, Program as AnchorProgram } from "@coral-xyz/anchor";
import { SignerWalletAdapter } from "@solana/wallet-adapter-base";
import { ConfirmOptions, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { Idl } from "@coral-xyz/anchor";

export type Program<T extends Idl> = Omit<AnchorProgram<T>, "provider"> & {
  provider: AnchorProvider;
};
export type ProgramReadonly<T extends Idl> = AnchorProgram<T>;

export type Amount = BigNumber | number | string;

export type Wallet = Pick<SignerWalletAdapter, "signAllTransactions" | "signTransaction"> & {
  publicKey: PublicKey;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
};

export interface TransactionOptions extends ConfirmOptions {
  dryRun?: boolean;
}

export interface InstructionsWrapper {
  instructions: TransactionInstruction[];
  keys: Keypair[];
}

export interface WrappedI80F48 {
  value: BN;
}
interface valueItem {
  value: any
}
interface creditDebit {
  assetNtokenRatio: valueItem,
  debtNtokenRatio: valueItem,
  reserveDebtNtokenAmount: valueItem,
  reserveAssetNtokenAmount: valueItem,
  updateTimeOfInterest: any
}
interface tokenInfo {
  tokenAccount: String,
  tokenAccountBump: any,
  tokenAccountAuthorityBump: any,
  aliPadding1: any
}
interface treasury {
  treasuryTokenAccount: String,
  treasuryTokenAccountBump: any,
  treasuryAuthorityBump: any,
  aliPadding1: any,
  unpayedTreasuryFee:valueItem
}
interface marketFee {
  marketFeeTokenAccount: String,
  marketFeeAccountBump: any,
  marketFeeAuthorityBump: any,
  aliPadding1: any,
  unpayedMarketFee:valueItem
}
interface interestSetting {
  rateChangeUr1: valueItem,
  irUr1: valueItem,
  rateChangeUr2: valueItem,
  irUr2: valueItem,
  maxIr: valueItem,
  treasuryBaseApr: valueItem,
  treasuryAdditionRatio: valueItem,
  marketFeeBase: valueItem,
  marketAdditionRatio: valueItem,
  padding: any
}
interface setting {
  assetValueRatio: valueItem,
  assetValueLiqRatio: valueItem,
  debtValueRatioHighRisk: valueItem,
  debtValueRatioMidRisk: valueItem,
  debtValueRatioLowRisk: valueItem,
  debtValueLiqRatio: valueItem,
  capacity: any,
  interestSetting: interestSetting,
  reserveType: {
    collateral: any
  },
  operationalState: {
    operational: any
  },
  aliPadding1: any,
  oracleType: {
    pythEma: any
  },
  oracleKeys: any,
  maxBorrowable:any,
  maxExposure:any,
  padding: any
}
export interface nxlendReserveData {
  market: String,
  tokenMint: String,
  tokenDecimals: Number,
  aliPadding1: any,
  creditDebit: creditDebit,
  tokenInfo: tokenInfo,
  treasury: treasury,
  marketFee: marketFee,
  setting: setting,
  emissionsFlags: any,
  emissionsRate: any,
  emissionsRemaining: valueItem,
  emissionsMint: any,
  padding0: any,
  padding1: any
}