const { ApiPromise, WsProvider, Keyring } = require("@polkadot/api")
const { cryptoWaitReady } = require("@polkadot/util-crypto")
const util = require("@polkadot/util")
const fs = require("fs")
const bn = require("bn.js")

const IN_FILE = "extrinsics.json"
const NODE_ADDRESS = "ws://127.0.0.1:9945"
const MNEMONIC = "//Alice"

const SIG_TYPE_ED25519 = new Uint8Array([0]);

function updateSig(signature) {
  console.log("update to multisig")
  return util.u8aConcat(
    SIG_TYPE_ED25519,
    signature
  )
}

function mapArg(method, argNum, mapper) {
  return (...args) => {
    if (args.length >= argNum) args[argNum] = mapper(args[argNum])
    return method(...args)
  }
}

async function replayExtrinsics() {

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
    "AddDelegation": mapArg(api.tx.delegation.addDelegation, 5, updateSig),
    "RevokeDelegation": api.tx.delegation.revokeDelegation,
  };

  console.log("May the finalized swim once again in the pool of living, to be compiled, authored and, once again, finalized.")

  const extrinsics = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'))

  let nonce = (await api.query.system.account(iamroot.address)).nonce
  let counter = 0
  for (let oldTX of extrinsics) {
    counter += 1
    console.log("Its a", oldTX.method)

    if (typeof CallIndices[oldTX.method] !== "undefined") {
      let tx = CallIndices[oldTX.method](...oldTX.args)

      console.log("nonce", nonce)
      nonce = new bn.BN(1).add(nonce)
      await api.tx.sudo.sudoAs(oldTX.signer, tx).signAndSend(iamroot, {nonce})
    }
  }
  console.log(`\n\nResurrected ${counter} transactions! May the dark node have mercy!`)
}

replayExtrinsics().then(() => {
  console.log("OK BYE!")
}, (err) => {
  console.log("BAD THING!\n\n", err)
})
