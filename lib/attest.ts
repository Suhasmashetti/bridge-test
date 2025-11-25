import { wormhole, Wormhole, signSendWait, toNative } from "@wormhole-foundation/sdk";
import solana from "@wormhole-foundation/sdk/solana";
import evm from "@wormhole-foundation/sdk/evm";
import { getSigner } from "./helper";

(async () => {
  const wh = await wormhole("Testnet", [solana, evm]);

  const srcChain  = wh.getChain("Solana");
  const destChain = wh.getChain("Sepolia");

  const tokenMint = "4UaLuXZqDT4WFKSkxR9VB1hgyi4DwcBvRiWoTF9YuyJN";
  const tokenId   = Wormhole.tokenId("Solana", tokenMint);

  // --- signers ---
  const source      = await getSigner(srcChain);
  const destination = await getSigner(destChain);

  const tbOrig = await srcChain.getTokenBridge();
  const tbDest = await destChain.getTokenBridge();

  // 1) Check if already wrapped
  try {
    const wrapped = await tbDest.getWrappedAsset(tokenId);
    console.log("Already wrapped on Sepolia:", wrapped);
    return;
  } catch {
    console.log("Not wrapped yet, proceeding with attestation...");
  }

  // 2) Solana: create attestation
  const tokenAddr = Wormhole.parseAddress("Solana", tokenMint);
  const payerSrc  = Wormhole.parseAddress("Solana", source.signer.address().toString());

  console.log("Creating attestation on Solana...");
  const attestTxns = tbOrig.createAttestation(tokenAddr, payerSrc);
  const srcTxids   = await signSendWait(srcChain, attestTxns, source.signer);

  const solanaTx = srcTxids[0]!.txid;
  console.log("Attestation submitted on Solana:", solanaTx);

  // 3) Parse tx → message
  const msgs = await srcChain.parseTransaction(solanaTx);
  const msg  = msgs[0]!;
  console.log("VAA message:", msg);

  // 4) Fetch VAA
  const timeout = 5 * 60 * 1000;
  const vaa = await wh.getVaa(msg, "TokenBridge:AttestMeta", timeout);
  if (!vaa) throw new Error("Timed out waiting for VAA");
  console.log("Got VAA for attestation");

  

  // 5) Submit attestation on Sepolia
  console.log("Submitting attestation on Sepolia...");

  const payerDest = toNative(destChain.chain, destination.signer.address());
  const subAttestation = tbDest.submitAttestation(vaa, payerDest);

  console.dir(subAttestation, { depth: null }); // 👈 TEMP: debug

  const destTxids = await signSendWait(destChain, subAttestation, destination.signer);
  console.log("Attestation tx on Sepolia:", destTxids);

  // 6) Confirm wrapped exists
  const wrapped = await tbDest.getWrappedAsset(tokenId);
  console.log("✅ Wrapped ERC-20 on Sepolia:", wrapped);
})();
