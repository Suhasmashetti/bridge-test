import { wormhole, amount, Wormhole } from '@wormhole-foundation/sdk';
import solana from '@wormhole-foundation/sdk/solana';
import evm from '@wormhole-foundation/sdk/evm';
import { getSigner, getTokenDecimals } from '../lib/helper';

(async function () {
  try {
    console.log('Initializing Wormhole SDK for burn/unlock (EVM -> Solana)...');
    const wh = await wormhole('Testnet', [solana, evm]);
    console.log('Wormhole SDK initialized');

    const sepoliaWrappedToken = '0xd6744bE1D4BA00e930DB6aB78723a380c345a259';

    const sendChain = wh.getChain('Sepolia');
    const rcvChain = wh.getChain('Solana');

    const source = await getSigner(sendChain); 
    const destination = await getSigner(rcvChain); 

    const tokenId = Wormhole.tokenId('Sepolia', sepoliaWrappedToken);

    const amt = '10';

    const decimals = await getTokenDecimals(wh, tokenId, sendChain);
    const transferAmount = amount.units(amount.parse(amt, decimals));

    const xfer = await wh.tokenTransfer(
      tokenId,
      transferAmount,
      source.address,
      destination.address,
      'TokenBridge'
    );

    console.log('Starting Burn on Sepolia (sending back to Solana)...');
    const srcTxids = await xfer.initiateTransfer(source.signer);
    console.log('Burn / Transfer initiated:', srcTxids);

    console.log('Fetching Attestation for burn/unlock transfer...');
    const timeout = 5 * 60 * 1000;
    await xfer.fetchAttestation(timeout);

    console.log('Completing Unlock on Solana...');
    const destTxids = await xfer.completeTransfer(destination.signer);
    console.log('Completed Unlock on Solana:', destTxids);

    process.exit(0);
  } catch (error) {
    console.error('Error during burn/unlock transfer:', error);
    process.exit(1);
  }
})();
