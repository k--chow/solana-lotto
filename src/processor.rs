use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack},
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
};

// crate for LotteryError
use crate::{error::LotteryError, instruction::LotteryInstruction, state::Lottery};

use std::convert::TryInto;

pub struct Processor;
impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = LotteryInstruction::unpack(instruction_data)?;

        match instruction {
            LotteryInstruction::InitLottery => {
                msg!("Instruction: InitLottery");
                // dont need anything
                Self::process_init_lottery(accounts, program_id)
            }
            LotteryInstruction::Play => {
                msg!("Instruction: Play");
                // need to send one sol
                Self::process_play(accounts, program_id)
            }
            LotteryInstruction::Draw => {
                msg!("Instruction: Draw");
                // needs to be manager!
                Self::process_draw(accounts, program_id)
            }
        }
    }
    // set manager = signer
    fn process_init_lottery(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        // manager
        let initializer = next_account_info(account_info_iter)?;

        if !initializer.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // generated key pair (for program's account)
        let lottery_account = next_account_info(account_info_iter)?;
        let rent = &Rent::from_account_info(next_account_info(account_info_iter)?)?;

        if !rent.is_exempt(lottery_account.lamports(), lottery_account.data_len()) {
            return Err(LotteryError::NotRentExempt.into());
        }

        let mut lottery_info = Lottery::unpack_unchecked(&lottery_account.try_borrow_data()?)?;
        if lottery_info.is_initialized() {
            return Err(ProgramError::AccountAlreadyInitialized);
        }

        lottery_info.is_initialized = true;
        lottery_info.manager_pubkey = *initializer.key;
        //lottery_info.participants = Vec::new();
        // store into data space
        Lottery::pack(lottery_info, &mut lottery_account.try_borrow_mut_data()?)?;
        // ??


        Ok(())
    }

    fn process_play(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        // initializer
        let player = next_account_info(account_info_iter)?;

        if !player.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }
        // for instructions
        let system_program_account = next_account_info(account_info_iter)?;

        // pda account
        let pda_account = next_account_info(account_info_iter)?;
        
        let (pda, nonce) = Pubkey::find_program_address(&[b"escrow"], program_id);
        
        // check if enough sol to transfer, check for errors
        // https://github.com/solana-labs/solana-program-library/blob/master/examples/rust/transfer-lamports/src/processor.rs

        if player.lamports() < 1 {
            return Err(ProgramError::InsufficientFunds);
        }

        let instruction = system_instruction::transfer(&player.key, &pda_account.key, 1);

        invoke(
            &instruction,
            &[
                system_program_account.clone(),
                pda_account.clone(),
                player.clone(),
            ],
        )?;

        /*
        **player.try_borrow_mut_lamports()? -= 1;
        // Deposit five lamports into the destination
        **pda.try_borrow_mut_lamports()? += 1;
        */


        // get lottery info
        // add to participants

        // generated key pair (for program's account)
        let lottery_account = next_account_info(account_info_iter)?;

        let mut lottery_info = Lottery::unpack(&lottery_account.try_borrow_data()?)?;

        lottery_info.add(*player.key);

        Ok(())

    }

    fn process_draw(
        accounts: &[AccountInfo],
        program_id: &Pubkey,
    ) -> ProgramResult {
        // give it to number one guy for now
        let account_info_iter = &mut accounts.iter();
        let initializer = next_account_info(account_info_iter)?;

        if !initializer.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        // generated key pair (for program's account)
        let lottery_account = next_account_info(account_info_iter)?;

        let lottery_info = Lottery::unpack(&lottery_account.try_borrow_data()?)?;

        // chcek tht initializer is manager

        if *initializer.key != lottery_info.manager_pubkey {
            return Err(ProgramError::InvalidAccountData);
        }

        // draw and transfer from pda to winner

        let (pda, nonce) = Pubkey::find_program_address(&[b"escrow"], program_id);

        // pda account pubkey
        let pda_account = next_account_info(account_info_iter)?;

        // for instructions
        let system_program_account = next_account_info(account_info_iter)?;
        // should take from participants list, get account
        let winner = initializer;
        
        let instruction = system_instruction::transfer(&winner.key, &pda_account.key, lottery_info.participants.len().try_into().unwrap());

        invoke_signed(
            &instruction,
            &[
                system_program_account.clone(),
                pda_account.clone(),
                winner.clone(),
            ],
            &[&[&b"lottery"[..], &[nonce]]],
        )?;

        // close pda account or no?
        // close lottery account or no?

        Ok(())
    }
}
