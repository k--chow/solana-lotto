### Environment Setup
1. Install Rust from https://rustup.rs/
2. Install Solana from https://docs.solana.com/cli/install-solana-cli-tools#use-solanas-install-tool

### Build and test for program compiled natively
```
$ cargo build
$ cargo test
```

### Build and test the program compiled for BPF
```
$ cargo build-bpf
$ cargo test-bpf
```

## Deploy

Might need to do this:

```bash
solana config set --url localhost
solana-keygen new
```

```bash
# In one terminal tab
solana-test-validator
# In another tab
solana program deploy ./target/deploy/solana_lottery.so
```

Might also need:

```bash
# check your config
solana config get
# Copy-paste your key file defined in  /Users/USER/.config/solana/cli/config.yml to `js/`
```

## Node command

You have to set CONNECTION and PROGRAM_ID. Either in a file or as args. And drop your id.json file into the folder as stated above.

In a file:

```bash
# js/.env:
CONNECTION=local
PROGRAM_ID=BXvetcetcetcrm
# then run
. .env && node build/bindings.js
```

As args:

```bash
CONNECTION=local PROGRAM_ID=BXvetcetcetcrm node build/bindings.js
```