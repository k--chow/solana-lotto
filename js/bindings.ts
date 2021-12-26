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



// @ts-expect-error
import * as BufferLayout from "buffer-layout";

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

const programId: PublicKey = new PublicKey("24PRzCJfPmXbLy6zgrFZjf4w4XuaQ3Mhc6grdi6A2UNM");

const connectionURL = "https://api.devnet.solana.com";
// define keypairs

const managerSecretKey = Uint8Array.from([
    170, 240, 169, 213, 84, 142, 67, 182, 168, 158, 199, 115, 204, 104, 53, 101, 248, 130, 251, 238, 190, 42, 194, 252,
    140, 178, 129, 145, 225, 152, 119, 21, 228, 64, 82, 55, 93, 74, 194, 217, 55, 176, 110, 147, 248, 203, 26, 36, 222,
    211, 119, 239, 85, 125, 66, 146, 223, 67, 112, 142, 62, 168, 86, 187,
])
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

    const connection = new Connection(clusterApiUrl("devnet"))
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
