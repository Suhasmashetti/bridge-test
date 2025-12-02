import { wormhole, amount, Wormhole } from '@wormhole-foundation/sdk';
import solana from '@wormhole-foundation/sdk/solana';
import evm from '@wormhole-foundation/sdk/evm';
import { getSigner, getTokenDecimals } from '../lib/helper';

(async function () {
  try {
    console.log('Initializing Wormhole SDK...');
    const wh = await wormhole('Testnet', [solana, evm]);
    console.log('Wormhole SDK initialized');

    const tokenMint = '79xXY1nrGXbJ35c5xcTdyayss5r1BLPUWBhZ3eko41Yc';

    const sendChain = wh.getChain('Solana');
    const rcvChain = wh.getChain('Sepolia');

    const source = await getSigner(sendChain);
    const destination = await getSigner(rcvChain);

    const tokenId = Wormhole.tokenId('Solana', tokenMint);
    const amt = '100';

    const decimals = await getTokenDecimals(wh, tokenId, sendChain);
    const transferAmount = amount.units(amount.parse(amt, decimals));

    const xfer = await wh.tokenTransfer(
      tokenId,
      transferAmount,
      source.address,
      destination.address,
      'TokenBridge'
    );

    console.log('Starting Transfer');
    const srcTxids = await xfer.initiateTransfer(source.signer);
    console.log('Started Transfer:', srcTxids);

    console.log('Fetching Attestation');
    const timeout = 5 * 60 * 1000;
    await xfer.fetchAttestation(timeout);

    console.log('Completing Transfer on Sepolia');
    const destTxids = await xfer.completeTransfer(destination.signer);
    console.log('Completed Transfer:', destTxids);

    process.exit(0);
  } catch (error) {
    console.error('Error during transfer:', error);
    process.exit(1);
  }
})();
