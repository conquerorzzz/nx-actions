import { 
  PublicKey,
  Connection,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  Keypair
} from "@solana/web3.js";
import { Base64 } from 'js-base64';
import {Buffer} from 'buffer';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
  getAccount
} from '@solana/spl-token'
import * as anchor from "@project-serum/anchor";
import { NodeWallet } from "./utils/nodeWallet";
import idl  from './nxlend.json'
import BigNumber from 'bignumber.js';
import { 
  NATIVE_MINT,
  programLendingIdStr,
  marketAccKey,
  node_rpc,
  RESERVE_ONLINE_DATA,
  SOL_WRAP_FACTOR,
  look_up_address
} from './value'
import {
  createSyncNativeInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
  wrappedI80F48toBigNumber
} from './utils/common'

export interface nxlendTokenMetadata {
  address: string;
  reserveAddress: string;
  decimals: number;
  name?: string;
  tokenSymbol?: string;
  logoURI: string;
  tokenMint: string;
  tokenName: string;
  tags: string[];
}
let programLendingId = new PublicKey(
  programLendingIdStr
)

let marketAcc = new PublicKey(
  marketAccKey
)
const lookUpTable = new PublicKey(look_up_address)
const connection = new Connection(node_rpc, "confirmed");

export const createNxlendApi = () => {

  const getStrictList = async (): Promise<nxlendTokenMetadata[]> => {
    try {
      const response = await fetch(RESERVE_ONLINE_DATA);

      if (!response.ok) {
        return [];
      }

      return await response.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const lookupToken = async (
    token: string | null,
  ): Promise<nxlendTokenMetadata | null> => {
    if (!token) {
      return null;
    }
    const tokenLowercase = token.toLowerCase().trim();
    const nxlendTokenMetadata = await getStrictList();
    const nxTokenMetaDatum = nxlendTokenMetadata.find(
      (token) =>
        token.tokenSymbol?.toLowerCase() === tokenLowercase ||
        token.address?.toLowerCase() === tokenLowercase,
    );

    return nxTokenMetaDatum ?? null;
  };

  const deposit = async(
    token:nxlendTokenMetadata, 
    amount: string,
    accountStr: string
  )=>{
    const account = new PublicKey(accountStr)
    const reserve = new PublicKey(token.reserveAddress)
    const reserve_mint = new PublicKey(token.tokenMint)
    const [liquidity_vault, liquidity_vault_bump] = PublicKey.findProgramAddressSync(
      [Buffer.from(anchor.utils.bytes.utf8.encode("reserve_token_acc_seed")), reserve.toBuffer()],
      programLendingId
    );
    const reserve_l_v_g = liquidity_vault;
    const wallet = new NodeWallet(new Keypair());
    anchor.setProvider(new anchor.AnchorProvider(connection, wallet, {}));
    const program = new anchor.Program(idl as anchor.Idl, programLendingId);
    const user_token_data = await makeTokenAccountIx(
      connection,
      account,
      reserve_mint,
      account,
      true
    )
    const userAccSeed = new anchor.BN(50);
    const [userAcc, userAccBump] = PublicKey.findProgramAddressSync(
      [marketAcc.toBuffer(), account.toBuffer(), userAccSeed.toArrayLike(Buffer, "le", 8)],
      programLendingId
    );
    const { isExist,key,createAccountIx }= await getNxlendAccount(account)
    const nxlend_acc_pbk = new PublicKey(key)
    const amountInt = Math.ceil(
      Number(amount) * 10 ** token.decimals,
    );
    const deposit_amount = new anchor.BN(amountInt);
    const ix = await program.methods.depositIntoReserve(
      deposit_amount
    ).accounts({
      nxlendMarket: marketAcc,
      nxlendAccount: nxlend_acc_pbk,
      signer: account,
      reserve: reserve,
      // signerTokenAccount: user_token_acc_key.address,
      signerTokenAccount: user_token_data.AssociatedTokenAddress,
      reserveAssetTokenAccount: reserve_l_v_g,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .signers([])
    .instruction()
    let Ixs = token.tokenMint === NATIVE_MINT.toBase58() ? wrapInstructionForWSol(account,ix,amountInt) : [ix];
    console.log('createAccountIx',createAccountIx)
    console.log('isExist',isExist)
    console.log('Ixs',Ixs)
    Ixs = isExist ? Ixs : [...[createAccountIx],...Ixs]
    console.log('Ixs',Ixs)
    const signature = await nxSendTransaction(Ixs,account);
    return signature
  }
  async function getNxlendAccount(
    account: PublicKey
  ){
    const userAccSeed = new anchor.BN(50);
    const [userAcc, userAccBump] = PublicKey.findProgramAddressSync(
      [marketAcc.toBuffer(), account.toBuffer(), userAccSeed.toArrayLike(Buffer, "le", 8)],
      programLendingId
    );
    const wallet = new NodeWallet(new Keypair());
    anchor.setProvider(new anchor.AnchorProvider(connection, wallet, {}));
    const program = new anchor.Program(idl as anchor.Idl, programLendingId);
    let nxlendAccData
    try {
      nxlendAccData = await program.account.nxlendAccount.fetch(userAcc)
      return {
        isExist: true,
        key: userAcc.toBase58(),
        data: nxlendAccData,
        createAccountIx: null
      }
    } catch (error) {
      console.log('nxlendAccount.fetch',error)
          //create account
      const ix = await program.methods.createUserAccount(userAccSeed
        ).accounts({
          nxlendMarket: marketAcc,
          nxlendAccount: userAcc,
          owner: account,
          feePayer: account,
          systemProgram: SystemProgram.programId
        })
        .signers([])
        .instruction()
        return {
          isExist: false,
          key: userAcc.toBase58(),
          data: null,
          createAccountIx: ix
        }
    }

  }
  async function nxSendTransaction($ixs:any,account:PublicKey) {
    let Ixs = $ixs

    const getLatestBlockhashAndContext = await connection.getLatestBlockhashAndContext();
    const blockhash = getLatestBlockhashAndContext.value.blockhash;
    const lookupTableAccount = (await connection.getAddressLookupTable(lookUpTable)).value;
    const messageV0 = new TransactionMessage({
      payerKey: account,
      recentBlockhash: blockhash,
      instructions: Ixs, // Note: this is an array of instructions
    }).compileToV0Message([lookupTableAccount!]);
    // Create a v0 transaction from the v0 message
    const transactionV0 = new VersionedTransaction(messageV0);
    return toBuffer(transactionV0.serialize()).toString('base64')
  }
  
  function wrapInstructionForWSol(
    walletAddress: PublicKey,
    ix: any,
    amount: any)
  {
    return [...makeWrapSolIxs(walletAddress, new BigNumber(amount)), ix,makeUnwrapSolIx(walletAddress)];
  }
  function makeWrapSolIxs(walletAddress: PublicKey, amount: BigNumber){
    const address = getAssociatedTokenAddressSync(NATIVE_MINT, walletAddress, true);
    const ixs = [createAssociatedTokenAccountIdempotentInstruction(walletAddress, address, walletAddress, NATIVE_MINT)];
  
    if (amount.gt(0)) {
      // const nativeAmount = uiToNative(amount, 9).toNumber() + 10000;
      // const nativeAmount = amount.plus(10000).toNumber();
      const nativeAmount = Number(amount.times(new BigNumber(1).plus(SOL_WRAP_FACTOR)).toNumber().toFixed(0));
      console.log(amount)
      console.log(nativeAmount)
      ixs.push(
        SystemProgram.transfer({ fromPubkey: walletAddress, toPubkey: address, lamports: nativeAmount }),
        createSyncNativeInstruction(address)
      );
    }
  
    return ixs;
  }
  
  function makeUnwrapSolIx(walletAddress: PublicKey) {
    const address = getAssociatedTokenAddressSync(NATIVE_MINT, walletAddress, true);
    return createCloseAccountInstruction(address, walletAddress, walletAddress);
  }
  async function makeTokenAccountIx(
    connection: Connection,
    payer: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve: boolean,
    needNew: boolean = true,
  ){
    const AssociatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner
    )
    const ix = createAssociatedTokenAccountIdempotentInstruction(
      payer, // payer
      AssociatedTokenAddress, // ata
      owner, // owner
      mint // mint
    )
    try {
      const tokenAccount = await getAccount(
        connection,
        AssociatedTokenAddress
      )
      return {
        AssociatedTokenAddress,
        ix,
        isExit: true
      }
    } catch (error) {
      return {
        AssociatedTokenAddress,
        ix,
        isExit: false
      }
    }
  }
  const toBuffer = (arr: Buffer | Uint8Array | Array<number>): Buffer => {
    if (Buffer.isBuffer(arr)) {
      return arr;
    } else if (arr instanceof Uint8Array) {
      return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    } else {
      return Buffer.from(arr);
    }
  };  
  return {
    lookupToken,
    deposit
  };
};

const nxlendApi = createNxlendApi();

export default nxlendApi;
