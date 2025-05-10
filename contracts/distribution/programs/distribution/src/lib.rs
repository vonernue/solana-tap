use anchor_lang::prelude::*;
use anchor_lang::solana_program::{pubkey, pubkey::Pubkey};
use anchor_lang::system_program::{self, Transfer as SolTransfer};
use anchor_lang::AccountDeserialize;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer as SplTransfer}; // for TokenAccount::try_deserialize

declare_id!("5yMSxny1HYeKq6v33SdawjvE4HCRueNwsoS6mdNxHRXF");

#[program]
pub mod distribution_program {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        recipients: Vec<Pubkey>,
        percentages: Vec<u16>,
    ) -> Result<()> {
        // basic validation
        require!(
            recipients.len() == percentages.len(),
            ErrorCode::LengthMismatch
        );
        let sum: u16 = percentages.iter().copied().sum();
        require!(sum <= 10_000, ErrorCode::InvalidTotal);

        // fill out the PDA-backed config
        let cfg = &mut ctx.accounts.config;
        cfg.authority = *ctx.accounts.authority.key;
        // record the bump so we can re-derive later
        cfg.bump = ctx.bumps.config;
        cfg.recipients = recipients;
        cfg.percentages = percentages;
        Ok(())
    }

    pub fn update_recipients(
        ctx: Context<UpdateRecipients>,
        recipients: Vec<Pubkey>,
        percentages: Vec<u16>,
    ) -> Result<()> {
        require!(
            recipients.len() == percentages.len(),
            ErrorCode::LengthMismatch
        );
        let sum: u16 = percentages.iter().copied().sum();
        require!(sum <= 10_000, ErrorCode::InvalidTotal);
        let cfg = &mut ctx.accounts.config;
        cfg.recipients = recipients;
        cfg.percentages = percentages;
        Ok(())
    }

    pub fn distribute_sol(ctx: Context<DistributeSol>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        let n = cfg.recipients.len();
        require!(n <= 10, ErrorCode::MaxRecipientsExceeded);

        let payer_info = ctx.accounts.payer.to_account_info();
        let sys_prog = ctx.accounts.system_program.to_account_info();
        require!(
            **payer_info.lamports.borrow() >= amount,
            ErrorCode::InsufficientFunds
        );

        let incinerator: Pubkey = pubkey!("1nc1nerator11111111111111111111111111111111");
        let raw = [
            ctx.accounts.recipient0.to_account_info(),
            ctx.accounts.recipient1.to_account_info(),
            ctx.accounts.recipient2.to_account_info(),
            ctx.accounts.recipient3.to_account_info(),
            ctx.accounts.recipient4.to_account_info(),
            ctx.accounts.recipient5.to_account_info(),
            ctx.accounts.recipient6.to_account_info(),
            ctx.accounts.recipient7.to_account_info(),
            ctx.accounts.recipient8.to_account_info(),
            ctx.accounts.recipient9.to_account_info(),
        ];
        // filter out any “incinerator” slots:
        let mut dests = Vec::with_capacity(n);
        for acc in raw.iter() {
            if acc.key != &incinerator {
                dests.push(acc.clone());
            }
        }
        require!(dests.len() == n, ErrorCode::InvalidRecipientCount);

        // do each share
        for i in 0..n {
            let to = &dests[i];
            require!(to.key == &cfg.recipients[i], ErrorCode::InvalidRecipient);
            let share = amount.checked_mul(cfg.percentages[i] as u64).unwrap() / 10_000;
            if share > 0 {
                let cpi_accs = SolTransfer {
                    from: payer_info.clone(),
                    to: to.clone(),
                };
                let cpi_ctx = CpiContext::new(sys_prog.clone(), cpi_accs);
                system_program::transfer(cpi_ctx, share)?;
            }
        }
        Ok(())
    }

    pub fn distribute_spl_amount(ctx: Context<DistributeSplAmount>, amount: u64) -> Result<()> {
        let cfg = &ctx.accounts.config;
        let n = cfg.recipients.len();
        require!(n <= 10, ErrorCode::MaxRecipientsExceeded);

        // payer’s token account must belong to the signer
        require!(
            ctx.accounts.from_ata.owner == *ctx.accounts.payer.key,
            ErrorCode::InvalidTokenOwner
        );
        require!(
            ctx.accounts.from_ata.amount >= amount,
            ErrorCode::InsufficientTokenBalance
        );

        let incinerator: Pubkey = pubkey!("1nc1nerator11111111111111111111111111111111");
        let token_prog = ctx.accounts.token_program.to_account_info();
        let from_ata_info = ctx.accounts.from_ata.to_account_info();

        let raw = [
            ctx.accounts.recipient0_ata.to_account_info(),
            ctx.accounts.recipient1_ata.to_account_info(),
            ctx.accounts.recipient2_ata.to_account_info(),
            ctx.accounts.recipient3_ata.to_account_info(),
            ctx.accounts.recipient4_ata.to_account_info(),
            ctx.accounts.recipient5_ata.to_account_info(),
            ctx.accounts.recipient6_ata.to_account_info(),
            ctx.accounts.recipient7_ata.to_account_info(),
            ctx.accounts.recipient8_ata.to_account_info(),
            ctx.accounts.recipient9_ata.to_account_info(),
        ];

        let mut idx = 0;
        for ata in raw.iter() {
            if ata.key != &incinerator {
                // deserialize just to check owner matches the config
                {
                    let data_ref: &[u8] = &ata.data.borrow();
                    let mut slice = data_ref;
                    let account: TokenAccount = TokenAccount::try_deserialize(&mut slice)?;
                    require!(
                        account.owner == cfg.recipients[idx],
                        ErrorCode::InvalidRecipient
                    );
                }

                let share = amount.checked_mul(cfg.percentages[idx] as u64).unwrap() / 10_000;
                if share > 0 {
                    let cpi_accs = SplTransfer {
                        from: from_ata_info.clone(),
                        to: ata.clone(),
                        authority: ctx.accounts.payer.to_account_info(),
                    };
                    let cpi_ctx = CpiContext::new(token_prog.clone(), cpi_accs);
                    token::transfer(cpi_ctx, share)?;
                }
                idx += 1;
            }
        }
        require!(idx == n, ErrorCode::InvalidRecipientCount);
        Ok(())
    }
}

//
// ─── ACCOUNT STRUCTS ────────────────────────────────────────────────────────────
//

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"config", authority.key.as_ref()],
        bump,
        payer = authority,
        space = 8 + Config::LEN
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateRecipients<'info> {
    // only the PDA owner can update
    #[account(
        mut,
        seeds = [b"config", authority.key.as_ref()],
        bump = config.bump,
        has_one = authority
    )]
    pub config: Account<'info, Config>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct DistributeSol<'info> {
    // validate the same PDA without needing a second signer
    #[account(
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,

    #[account(mut)]
    pub recipient0: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient1: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient2: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient3: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient4: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient5: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient6: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient7: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient8: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient9: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct DistributeSplAmount<'info> {
    #[account(
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = from_ata.owner == *payer.key @ ErrorCode::InvalidTokenOwner
    )]
    pub from_ata: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,

    #[account(mut)]
    pub recipient0_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient1_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient2_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient3_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient4_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient5_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient6_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient7_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient8_ata: UncheckedAccount<'info>,
    #[account(mut)]
    pub recipient9_ata: UncheckedAccount<'info>,
}

//
// ─── STATE + ERRORS ──────────────────────────────────────────────────────────────
//

#[account]
pub struct Config {
    pub authority: Pubkey,
    pub bump: u8,
    pub recipients: Vec<Pubkey>,
    pub percentages: Vec<u16>,
}

impl Config {
    // 32 (authority) + 1 (bump) + 4+32*10 (recipients) + 4+2*10 (percentages)
    pub const LEN: usize = 32 + 1 + (4 + 32 * 10) + (4 + 2 * 10);
}

#[error_code]
pub enum ErrorCode {
    #[msg("Recipients/percentages length mismatch")]
    LengthMismatch,
    #[msg("Total percentage exceeds 100%")]
    InvalidTotal,
    #[msg("Exceeded max recipients (10)")]
    MaxRecipientsExceeded,
    #[msg("Wrong number of valid recipients")]
    InvalidRecipientCount,
    #[msg("Account not in config")]
    InvalidRecipient,
    #[msg("Not enough SOL to cover requested amount")]
    InsufficientFunds,
    #[msg("Invalid token account owner")]
    InvalidTokenOwner,
    #[msg("Not enough tokens in ATA")]
    InsufficientTokenBalance,
}
