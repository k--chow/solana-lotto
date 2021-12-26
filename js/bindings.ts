/// <reference types="node" />
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Transaction,
  clusterApiUrl,
  Keypair,
  AccountInfo,
} from '@solana/web3.js';

import {readFileSync} from 'fs';

// @ts-expect-error
import * as BufferLayout from "buffer-layout";

console.log('configuration:', [
    ['CONNECTION', process.env.CONNECTION],
    ["PROGRAM_ID", process.env.PROGRAM_ID]
])
if (process.env.PROGRAM_ID == null) {
    throw Error("must provide PROGRAM_ID env variable")
}


export const publicKey = (
  property: string = 'publicKey',
): BufferLayout.Layout => {
  return BufferLayout.blob(32, property);
};

export const participants = (
  property: string = 'participants',
): BufferLayout.Layout => {
  return BufferLayout.unionBufferLayout.blob(32, property);
};

const programId: PublicKey = new PublicKey(process.env.PROGRAM_ID!);

const connectionURL = "https://api.devnet.solana.com";
// define keypairs

const json = JSON.parse(readFileSync('id.json', { encoding: 'utf-8' }))
console.log(json)
const managerSecretKey = Uint8Array.from(json)
const managerKeypair = Keypair.fromSecretKey(managerSecretKey);

const PARTICIPANT_COUNT = 3;

export const LOTTERY_ACCOUNT_DATA_LAYOUT = BufferLayout.struct([
  BufferLayout.u8("isInitialized"),
  publicKey("managerPubkey"),
  BufferLayout.seq(publicKey(), PARTICIPANT_COUNT, "participants"),
  BufferLayout.u8("p_current_idx"),
]);

const initLottery = async (managerKeypair: Keypair, lotteryProgramId: PublicKey) => {
    
    // manager keypair
    //const connection = new Connection(connectionURL, "confirmed");

    const connection =
        process.env.CONNECTION === 'local'
            ? new Connection('http://127.0.0.1:8899')
            : new Connection(clusterApiUrl('devnet'))
    const lotteryKeypair = new Keypair();
  
    const createLotteryAccountIx = SystemProgram.createAccount({
        space: LOTTERY_ACCOUNT_DATA_LAYOUT.span,
        lamports: await connection.getMinimumBalanceForRentExemption(
        LOTTERY_ACCOUNT_DATA_LAYOUT.span
        ),
        fromPubkey: managerKeypair.publicKey,
        newAccountPubkey: lotteryKeypair.publicKey,
        programId: lotteryProgramId,
    });

    const initLotteryIx = new TransactionInstruction({
        programId: lotteryProgramId,
        keys: [
        { pubkey: managerKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: lotteryKeypair.publicKey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(Uint8Array.of(0)),
    });

    const tx = new Transaction().add(
        createLotteryAccountIx,
        initLotteryIx
    );

    console.log("Sending manager's transaction...");

    await connection.sendTransaction(
        tx,
        [managerKeypair, lotteryKeypair],
        { skipPreflight: false, preflightCommitment: "confirmed" }
    );

    // sleep to allow time to update
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const lotteryAccount = await connection.getAccountInfo(
        lotteryKeypair.publicKey
    );

    if (lotteryAccount === null || lotteryAccount.data.length === 0) {
        console.log("Lottery state account has not been initialized properly");
        process.exit(1);
    }


    const decodedLotteryState = decodeLotteryState(lotteryAccount);
        
    if (!decodedLotteryState.isInitialized) {
        console.log("Lottery state initialization flag has not been set");
        process.exit(1);
    } else if (
        !new PublicKey(decodedLotteryState.managerPubkey).equals(
        managerKeypair.publicKey
        )
    ) {
        console.log(
        "ManagerPubkey has not been set correctly / not been set to Alice's public key"
        );
        process.exit(1);
    } 
    console.log(decodedLotteryState.participants, decodedLotteryState.p_current_idx);
    
}
/*
const playLottery = async() => {

}

const drawLottery = async() => {

}*/

export function decodeLotteryState(encodedLotteryState: AccountInfo<Buffer>) {
    const decodedLotteryState = LOTTERY_ACCOUNT_DATA_LAYOUT.decode(encodedLotteryState.data);
    let participants = decodedLotteryState.participants
        .map((participant: PublicKey) => new PublicKey(participant).toBase58());
    return {
        isInitialized: decodedLotteryState.isInitialized,
        managerPubkey: decodedLotteryState.managerPubkey.toBase58(),
        participants: participants,
        p_current_idx: decodedLotteryState.p_current_idx,
    };
}

initLottery(managerKeypair, programId);
