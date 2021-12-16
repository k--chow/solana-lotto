use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
    entrypoint::ProgramResult,
};

//use borsh::de::BorshDeserialize;

use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};
//use sol_template_shared::ACCOUNT_STATE_SPACE;

pub struct Lottery {
    pub is_initialized: bool,
    pub manager_pubkey: Pubkey, // manager
    pub participants: [Pubkey; 3], // array is [type, length], vec is dynamic
    pub p_current_idx: u8, //where in list to add
}

impl Sealed for Lottery {}

impl IsInitialized for Lottery {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Lottery {
    pub fn set_initialized(&mut self) {
        self.is_initialized = true;
    }
    // what do you return?
    pub fn add(&mut self, participant: Pubkey) {
        // add participants to list
        self.participants[self.p_current_idx as usize] = participant;
        self.p_current_idx += 1;
    }
}

impl Default for Lottery {
    fn default() -> Self {
        Lottery {
            is_initialized: true,
            manager_pubkey: Pubkey::default(),
            participants: [Pubkey::default(); 3],
            p_current_idx: 0,
        }
    }
}


impl Pack for Lottery {
    const LEN: usize = 130; // 1 + 32 + 3*32 + 1

    // insert into data area


    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, Lottery::LEN];
        let (
            is_initialized,
            manager_pubkey,
            participants_bytes,
            p_current_idx
        ) = array_refs![src, 1, 32, 96, 1];
        let is_initialized = match is_initialized {
            [0] => false,
            [1] => true,
            _ => return Err(ProgramError::InvalidAccountData),
        };

        let mut participants = [Pubkey::default(); 3];
        for (i, p) in participants.iter_mut().enumerate() {
            let (start, end) = (i * 32, i * 32 + 32);
            *p = Pubkey::new(&participants_bytes[start..end]);
        }

        let p_current_idx = p_current_idx[0];

        Ok(Lottery {
            is_initialized,
            manager_pubkey: Pubkey::new_from_array(*manager_pubkey),
            participants,
            p_current_idx,
            
        })
    }

    fn pack_into_slice(&self, dst: &mut [u8]) {
        // get the overall dst place
        let dst = array_mut_ref![dst, 0, Lottery::LEN];
        // index each part
        let (
            is_initialized_dst,
            manager_pubkey_dst,
            participants_dst,
            p_current_idx_dst,
        ) = mut_array_refs![dst, 1, 32, 96, 1];
        // get the variables like is_initialized
        let Lottery {
            is_initialized,
            manager_pubkey,
            participants,
            p_current_idx
        } = self;

        is_initialized_dst[0] = *is_initialized as u8;
        manager_pubkey_dst.copy_from_slice(manager_pubkey.as_ref());

        //participants_dst.copy_from_slice(&participants.unwrap());

        for (i, pubkey) in self.participants.iter().enumerate() {
            let (start, end) = (i * 32, i * 32 + 32);
            participants_dst[start..end].copy_from_slice(&pubkey.to_bytes());
        }

        p_current_idx_dst[0] = *p_current_idx;

    }

}   