import {
  ChainAddress,
  ChainContext,
  Network,
  Signer,
  Wormhole,
  Chain,
  isTokenId,
  TokenId,
} from '@wormhole-foundation/sdk';
import solana from '@wormhole-foundation/sdk/solana';
import evm from '@wormhole-foundation/sdk/evm';
import dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

const { EVM_PRIVATE_KEY, SOLANA_PRIVATE_KEY } = process.env;

/**
 * Returns a signer for the given chain using locally scoped credentials.
 * The required values (EVM_PRIVATE_KEY, SOL_PRIVATE_KEY, SUI_MNEMONIC) must
 * be loaded securely beforehand, for example via a keystore, secrets
 * manager, or environment variables (not recommended).
 */
export async function getSigner<N extends Network, C extends Chain>(
  chain: ChainContext<N, C>
): Promise<{
  chain: ChainContext<N, C>;
  signer: Signer<N, C>;
  address: ChainAddress<C>;
}> {
  let signer: Signer;
  const platform = chain.platform.utils()._platform;

  switch (platform) {
        case 'Solana':
      // If SOLANA_PRIVATE_KEY is a JSON array string, parse, convert to Uint8Array, then to base58
      const solanaKey = SOLANA_PRIVATE_KEY!.startsWith('[') 
        ? bs58.encode(Uint8Array.from(JSON.parse(SOLANA_PRIVATE_KEY!)))
        : SOLANA_PRIVATE_KEY!;
      signer = await (
        await solana()
      ).getSigner(await chain.getRpc(), solanaKey);
      break;
    case 'Evm':
      signer = await (
        await evm()
      ).getSigner(await chain.getRpc(), EVM_PRIVATE_KEY!);
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  return {
    chain,
    signer: signer as Signer<N, C>,
    address: Wormhole.chainAddress(chain.chain, signer.address()),
  };
}

/**
 * Get the number of decimals for the token on the source chain.
 * This helps convert a user-friendly amount (e.g., '1') into raw units.
 */
export async function getTokenDecimals<N extends Network>(
  wh: Wormhole<N>,
  token: TokenId,
  chain: ChainContext<N, any>
): Promise<number> {
  return isTokenId(token)
    ? Number(await wh.getDecimals(token.chain, token.address))
    : chain.config.nativeTokenDecimals;
}