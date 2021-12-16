use solana_program::program_error::ProgramError;
use std::convert::TryInto;

use crate::error::LotteryError::InvalidInstruction;

pub enum LotteryInstruction {
    InitLottery,
    Play,
    Draw
}

impl LotteryInstruction {
    /// Unpacks a byte buffer into a [EscrowInstruction](enum.EscrowInstruction.html).
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => Self::InitLottery,
            1 => Self::Play,
            2 => Self::Draw,
            _ => return Err(InvalidInstruction.into()),
        })
    }
}
