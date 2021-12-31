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

const playerASecretKey = Uint8Array.from([24,203,240,82,73,47,44,148,102,236,116,175,54,99,189,140,74,186,189,232,36,166,137,150,211,152,244,193,186,136,208,219,221,109,254,110,15,79,14,159,74,222,199,187,194,163,67,109,89,173,70,92,252,179,145,168,180,203,81,59,88,45,44,206])
const playerBSecretKey = Uint8Array.from([12,99,131,145,180,176,167,4,250,131,110,30,116,62,247,229,105,127,179,194,171,192,93,202,75,134,98,164,23,145,179,230,138,16,245,45,78,255,149,122,237,225,5,207,24,147,66,233,168,20,1,61,102,149,49,46,235,32,59,217,132,6,2,156])


const managerKeypair = Keypair.fromSecretKey(managerSecretKey);
const playerAKeypair = Keypair.fromSecretKey(playerASecretKey);
const playerBKeypair = Keypair.fromSecretKey(playerBSecretKey);



const PARTICIPANT_COUNT = 3;

export const LOTTERY_ACCOUNT_DATA_LAYOUT = BufferLayout.struct([
  BufferLayout.u8("isInitialized"),
  publicKey("managerPubkey"),
  BufferLayout.seq(publicKey(), PARTICIPANT_COUNT, "participants"),
  BufferLayout.u8("p_current_idx"),
]);

const initLottery = async (managerKeypair: Keypair, lotteryProgramId: PublicKey) => {
    
    // manager keypair
    // const connection = new Connection(connectionURL, "confirmed");

    const connection = new Connection(clusterApiUrl("devnet"), "confirmed")
    
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
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const lotteryAccount = await connection.getAccountInfo(
        lotteryKeypair.publicKey
    );

    if (lotteryAccount === null || lotteryAccount.data.length === 0) {
        console.log("Lottery state account has not been initialized 123properly", lotteryKeypair, lotteryKeypair.publicKey);
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
    console.log(decodedLotteryState.participants, decodedLotteryState.p_current_idx, lotteryKeypair.publicKey.toBase58(), lotteryKeypair);
    
}

const playLottery = async(lotteryProgramId: PublicKey, lotteryStateAccountPubkey: PublicKey, playerKeypair: Keypair) => {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed")

    const playInstruction = new TransactionInstruction({
        programId: lotteryProgramId,
        data: Buffer.from(
            Uint8Array.of(1)
        ),
        keys: [
            { pubkey: playerKeypair.publicKey, isSigner: true, isWritable: false },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: lotteryStateAccountPubkey, isSigner: false, isWritable: true },
            //
        ],
    });

    console.log("Sending player transaction...");
    
    await connection.sendTransaction(
        new Transaction().add(playInstruction),
            [playerKeypair], //signers and writers. VS lottery signing?
            { skipPreflight: false, preflightCommitment: "confirmed" }
    );

    await new Promise((resolve) => setTimeout(resolve, 8000));

    const lotteryAccount = await connection.getAccountInfo(
        lotteryStateAccountPubkey
    );
    if (lotteryAccount === null) {
        console.log("Could not find lottery at given address!");
        process.exit(1);
    }

    //decode state

    const decodedLotteryState = decodeLotteryState(lotteryAccount);
    console.log(decodedLotteryState.participants, decodedLotteryState.p_current_idx);

    // get the data again
    // check balances? player 1 less, contract 1 more
    const playerBalance = await connection.getBalance(playerKeypair.publicKey);
    const lotteryBalance = await connection.getBalance(lotteryStateAccountPubkey) // returns Promise(publicKey, )
    console.log(playerBalance, lotteryBalance);
}

const drawLottery = async(lotteryProgramId: PublicKey, lotteryStateAccountPubkey: PublicKey, initializerKeypair: Keypair) => {
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed")

    const drawInstruction = new TransactionInstruction({
        programId: lotteryProgramId,
        data: Buffer.from(
            Uint8Array.of(2)
        ),
        keys: [
            { pubkey: initializerKeypair.publicKey, isSigner: true, isWritable: false },
            { pubkey: lotteryStateAccountPubkey, isSigner: false, isWritable: true },
            //
        ],
    });

    console.log("Sending draw lottery")

    const initializerBalanceBefore = await connection.getBalance(initializerKeypair.publicKey);
    const lotteryBalanceBefore = await connection.getBalance(lotteryStateAccountPubkey) // returns Promise(publicKey, )
    console.log("Before", initializerBalanceBefore, lotteryBalanceBefore);

    const lotteryAccount = await connection.getAccountInfo(
        lotteryStateAccountPubkey
    );

    if (lotteryAccount === null) {
        console.log("Could not find lottery at given address!");
        process.exit(1);
    }

    const decodedLotteryState = decodeLotteryState(lotteryAccount);
    console.log(decodedLotteryState.participants, decodedLotteryState.p_current_idx);

    await connection.sendTransaction(
        new Transaction().add(drawInstruction),
            [initializerKeypair], //signers and writers. VS lottery signing?
            { skipPreflight: false, preflightCommitment: "confirmed" }
    );

    await new Promise((resolve) => setTimeout(resolve, 8000));

    
    // get the data again
    // check balances? player 1 less, contract 1 more
    const initializerBalance = await connection.getBalance(initializerKeypair.publicKey);
    const lotteryBalance = await connection.getBalance(lotteryStateAccountPubkey) // returns Promise(publicKey, )
    console.log(initializerBalance, lotteryBalance);

    

    //decode state
}

export function decodeLotteryState(encodedLotteryState: AccountInfo<Buffer>) {
    const decodedLotteryState = LOTTERY_ACCOUNT_DATA_LAYOUT.decode(encodedLotteryState.data);
    let participants = decodedLotteryState.participants
        .map((participant: PublicKey) => new PublicKey(participant).toBase58());
    return {
        isInitialized: decodedLotteryState.isInitialized,
        managerPubkey: new PublicKey(decodedLotteryState.managerPubkey).toBase58(),
        participants: participants,
        p_current_idx: decodedLotteryState.p_current_idx,
    };
}


//initLottery(managerKeypair, programId);
//playLottery(programId, new PublicKey("8xfCpZV1WHWPwHn22xjJProXSNJqKTCPyx55p4ZE6CXp"), playerAKeypair);
//playLottery(programId, new PublicKey("8xfCpZV1WHWPwHn22xjJProXSNJqKTCPyx55p4ZE6CXp"), playerBKeypair);
drawLottery(programId, new PublicKey("8xfCpZV1WHWPwHn22xjJProXSNJqKTCPyx55p4ZE6CXp"), managerKeypair);