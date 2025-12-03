import { wormhole, Wormhole } from '@wormhole-foundation/sdk';
import solana from '@wormhole-foundation/sdk/solana';
import evm from '@wormhole-foundation/sdk/evm';
import { getSigner } from '../lib/helper';

const BURN_TX_HASH = '0x70933c940d1b3f421bfc57d628541e267d2c65c9a8f79f970798541f8b7e310e';

(async function () {
  try {
    console.log('Initializing Wormhole SDK...');
    const wh = await wormhole('Testnet', [solana, evm]);
    console.log('Wormhole SDK initialized');

    const sepoliaWrappedToken = '0xd6744bE1D4BA00e930DB6aB78723a380c345a259';

    const sendChain = wh.getChain('Sepolia');
    const rcvChain = wh.getChain('Solana');

    const destination = await getSigner(rcvChain);

    console.log(`Parsing burn transaction: ${BURN_TX_HASH}`);
    const msgs = await sendChain.parseTransaction(BURN_TX_HASH);
    
    if (!msgs.length) {
      throw new Error('No Wormhole message found in transaction');
    }
    
    console.log('Found Wormhole message:', msgs[0]);

    console.log('\nFetching VAA (this may take a while on testnet)...');
    const timeout = 30 * 60 * 1000; // 30 minutes
    const vaa = await wh.getVaa(msgs[0], 'TokenBridge:Transfer', timeout);
    
    if (!vaa) {
      throw new Error('VAA not found - guardians may not have signed yet');
    }
    
    console.log('VAA received! Sequence:', vaa.sequence);

    console.log('\nCompleting unlock on Solana...');
    const tb = await rcvChain.getTokenBridge();
    const redeemTxs = tb.redeem(destination.address.address, vaa);
    
    const { signSendWait } = await import('@wormhole-foundation/sdk');
    const txids = await signSendWait(rcvChain, redeemTxs, destination.signer);
    
    console.log('Completed unlock on Solana:', txids.map(t => t.txid));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
