import { wormhole, Wormhole, signSendWait } from "@wormhole-foundation/sdk";
import solana from "@wormhole-foundation/sdk/solana";
import evm from "@wormhole-foundation/sdk/evm";
import { getSigner } from "./helper";
import { Wallet, JsonRpcProvider } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const TOKEN_MINT = "79xXY1nrGXbJ35c5xcTdyayss5r1BLPUWBhZ3eko41Yc";
const SEPOLIA_RPC_URLS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
  'https://rpc.sepolia.org'
];

// Helper: Get EVM provider
async function getProvider(evmSigner: any, dstChain: any): Promise<JsonRpcProvider> {
  let provider: any = evmSigner.provider || evmSigner._provider || evmSigner.connection?.provider;
  
  if (!provider) {
    const rpc = await dstChain.getRpc();
    if (rpc && typeof rpc === 'object' && 'send' in rpc) {
      provider = rpc;
    } else {
      for (const url of SEPOLIA_RPC_URLS) {
        try {
          provider = new JsonRpcProvider(url);
          await provider.getBlockNumber();
          break;
        } catch {
          continue;
        }
      }
    }
  }
  
  if (!provider) throw new Error("Could not get provider");
  return provider;
}

// Helper: Build transaction request from SDK transaction data
function buildTxRequest(txData: any): any {
  const txRequest: any = {
    to: txData.to?.toString(),
    data: txData.data?.toString(),
    value: txData.value ? BigInt(txData.value.toString()) : 0n,
  };

  // Copy gas-related fields
  if (txData.gasLimit) {
    txRequest.gasLimit = typeof txData.gasLimit === 'bigint' 
      ? txData.gasLimit 
      : BigInt(txData.gasLimit.toString());
  }
  if (txData.gasPrice) {
    txRequest.gasPrice = typeof txData.gasPrice === 'bigint'
      ? txData.gasPrice
      : BigInt(txData.gasPrice.toString());
  }
  if (txData.maxFeePerGas) {
    txRequest.maxFeePerGas = typeof txData.maxFeePerGas === 'bigint'
      ? txData.maxFeePerGas
      : BigInt(txData.maxFeePerGas.toString());
  }
  if (txData.maxPriorityFeePerGas) {
    txRequest.maxPriorityFeePerGas = typeof txData.maxPriorityFeePerGas === 'bigint'
      ? txData.maxPriorityFeePerGas
      : BigInt(txData.maxPriorityFeePerGas.toString());
  }

  return txRequest;
}

// Helper: Send transaction manually for EVM chains
async function sendEvmTransaction(
  tx: any,
  dstChain: any,
  dstSigner: any
): Promise<string> {
  if (!tx?.transaction) throw new Error("Invalid transaction object");

  const txData = tx.transaction;
  const provider = await getProvider(dstSigner, dstChain);
  const wallet = new Wallet(process.env.EVM_PRIVATE_KEY!, provider);
  const txRequest = buildTxRequest(txData);

  // Estimate gas if not provided
  if (!txRequest.gasLimit) {
    try {
      txRequest.gasLimit = await provider.estimateGas(txRequest);
    } catch (e: any) {
      console.warn("Gas estimation failed:", e.message);
    }
  }

  // Send and wait for confirmation
  const txResponse = await wallet.sendTransaction(txRequest);
  const receipt = await txResponse.wait();

  if (!receipt) throw new Error("Transaction receipt is null");
  if (receipt.status === 0) throw new Error(`Transaction reverted: ${txResponse.hash}`);

  return txResponse.hash;
}

(async () => {
  try {
    console.log("Starting attestation: Solana → Sepolia\n");

    // Initialize
    const wh = await wormhole("Testnet", [solana, evm]);
    const srcChain = wh.getChain("Solana");
    const dstChain = wh.getChain("Sepolia");
    const tokenId = Wormhole.tokenId("Solana", TOKEN_MINT);
    const tokenAddress = Wormhole.parseAddress("Solana", TOKEN_MINT);

    const src = await getSigner(srcChain);
    const dst = await getSigner(dstChain);
    const srcTB = await srcChain.getTokenBridge();
    const dstTB = await dstChain.getTokenBridge();

    // Check if already wrapped
    try {
      const wrapped = await dstTB.getWrappedAsset(tokenId);
      console.log(`✓ Already wrapped: ${wrapped.toString()}`);
      process.exit(0);
    } catch {
      console.log("→ Token not wrapped, proceeding...\n");
    }

    // Step 1: Create attestation on Solana
    console.log("Step 1: Creating attestation on Solana...");
    const attestTxs = srcTB.createAttestation(tokenAddress, src.address.address);
    const srcHashes = await signSendWait(srcChain, attestTxs, src.signer);
    const solTx = srcHashes[srcHashes.length - 1].txid;
    console.log(`✓ Solana tx: https://explorer.solana.com/tx/${solTx}?cluster=testnet`);

    // Step 2: Wait for VAA
    console.log("\nStep 2: Waiting for VAA...");
    const msgs = await srcChain.parseTransaction(solTx);
    if (!msgs.length) throw new Error("No Wormhole message");
    
    const vaa = await wh.getVaa(msgs[0], "TokenBridge:AttestMeta", 5 * 60 * 1000);
    if (!vaa) throw new Error("VAA timeout");
    console.log(`✓ VAA received (sequence: ${vaa.sequence})`);

    // Step 3: Submit attestation on Sepolia
    console.log("\nStep 3: Submitting attestation on Sepolia...");
    const submitTxsGen = dstTB.submitAttestation(vaa, dst.address.address); // asyn generator
    const submitTxs: any[] = [];
    for await (const tx of submitTxsGen) {
      submitTxs.push(tx);
    }

    const txHashes: string[] = [];
    for (const tx of submitTxs) {
      const hash = await sendEvmTransaction(tx, dstChain, dst.signer);
      txHashes.push(hash);
    }

    const ethTx = txHashes[txHashes.length - 1];
    console.log(`✓ Sepolia tx: https://sepolia.etherscan.io/tx/${ethTx}`);

    // Step 4: Get wrapped token address
    const wrapped = await dstTB.getWrappedAsset(tokenId);
    console.log(`\n✓ Wrapped token: ${wrapped.toString()}`);
    console.log(`  https://sepolia.etherscan.io/address/${wrapped}`);

    process.exit(0);
  } catch (error: any) {
    console.error("\n✗ Error:", error.message);
    if (error.receipt) {
      console.error("  Receipt status:", error.receipt.status);
      console.error("  Gas used:", error.receipt.gasUsed?.toString());
    }
    process.exit(1);
  }  
})();