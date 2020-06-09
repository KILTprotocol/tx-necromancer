const { ApiPromise, WsProvider, Keyring } = require("@polkadot/api")
const { cryptoWaitReady } = require("@polkadot/util-crypto")
const util = require("@polkadot/util")
const fs = require("fs")
const bn = require("bn.js")

const IN_FILE = "extrinsics.json"
const NODE_ADDRESS = "ws://127.0.0.1:9945"
const MNEMONIC = "//Alice"

async function replayExtrinsics() {
  console.log("Start")
  const wsProvider = new WsProvider(NODE_ADDRESS)
  const api = await ApiPromise.create({ provider: wsProvider, types: {
    DelegationNodeId: "Hash",
    PublicSigningKey: "Hash",
    PublicBoxKey: "Hash",
    Permissions: "u32",
    ErrorCode: "u16",
    Address: "AccountId",
    LookupSource: "AccountId",
    Signature: "MultiSignature",
    BlockNumber: "u64",
    Index: "u64"
    }
  })
  await cryptoWaitReady()
  const keyring = new Keyring({ type: 'ed25519' });
  const iamroot = keyring.addFromUri(MNEMONIC);

  const CallIndices = {
    "Timestamp": undefined,
    "Transfer": api.tx.balances.transfer,
    "CreateCtype": api.tx.ctype.add,
    "CreateAttestation": api.tx.attestation.add,
    "RevokeClaim": api.tx.attestation.revoke,
    "CreateDelegationRoot": api.tx.delegation.createRoot,
    "AddDelegation": api.tx.delegation.addDelegation,
    "RevokeDelegation": api.tx.delegation.revokeDelegation,
  };

  console.log("ready")
  console.dir(api, {depth: 3})

  const extrinsics = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'))

  let nonce = (await api.query.system.account(iamroot.address)).nonce

  for (let oldTX of extrinsics) {
    console.log("Its a", oldTX.method)

    if (typeof CallIndices[oldTX.method] !== "undefined") {
      let tx = CallIndices[oldTX.method](...oldTX.args)

      console.log("nonce", nonce)
      nonce = new bn.BN(1).add(nonce)
      await api.tx.sudo.sudoAs(oldTX.signer, tx).signAndSend(iamroot, {nonce})
    }
  }
}

replayExtrinsics().then(() => {
  console.log("OK BYE!")
}, (err) => {
  console.log("BAD THING!\n\n", err)
})
