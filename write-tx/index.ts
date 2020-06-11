import { ApiPromise, WsProvider, Keyring } from "@polkadot/api"
import { cryptoWaitReady } from "@polkadot/util-crypto"
import * as util from "@polkadot/util"
import * as fs from "fs"
import BN = require('bn.js/')

const IN_FILE = "extrinsics.json"
const NODE_ADDRESS = "ws://127.0.0.1:9945"
const MNEMONIC = "//Alice"

const PARALLEL = 800

const SIG_TYPE_ED25519 = new Uint8Array([0]);

enum SYSTEM_EVENTS {
  ExtrinsicSuccess = '0x0000',
  ExtrinsicFailed = '0x0001',
}

function updateSig(signature) {
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

function extrinsicFailed(extrinsicResult) {
  const events = extrinsicResult.events || []
  return (
    events.find((eventRecord) => {
      return (
        !eventRecord.phase.asApplyExtrinsic.isEmpty &&
        eventRecord.event.index.toHex() === SYSTEM_EVENTS.ExtrinsicFailed
      )
    }) !== undefined
  )
}

async function sendAsSudo(api, iamroot, oldSigner, tx, nonce) {
  return new Promise((resolve, reject) => {
    api.tx.sudo.sudoAs(oldSigner, tx).signAndSend(iamroot, {nonce, tip: 5}, result => {
        console.log(`Got tx status '${result.status.type}'`)

        if (extrinsicFailed(result)) {
          console.log(`Extrinsic execution failed`)
          console.log(`Transaction detail: ${JSON.stringify(result, null, 2)}`)
          reject(result)
        }
        if (result.isFinalized) {
          resolve(result)
        } else if (result.isError) {
          console.log(`Extrinsic execution failed`)
          reject(
            new Error(
              `Transaction failed with status '${result.status.type}'`
            )
          )
        }
      })
      .catch((err: Error) => {
        // just reject with the original tx error from the chain
        console.log(`Error!`, err)
        reject(err)
      })
  })
}

async function replayExtrinsics(api) {
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
    "AddDID": api.tx.did.add,
    "RemoveDID": api.tx.did.remove,
  };
  if (iamroot.address !== (await api.query.sudo.key()).toString()) {
    console.log(`Got key: ${iamroot.address}, but ${(await api.query.sudo.key()).toString()} is root`);
    throw Error("This is not the secret for the Sudo key.");
  }

  console.log("May the finalized swim once again in the pool of living, to be compiled, authored and, once again, finalized.")

  const extrinsics = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'))

  let nonce = (await api.query.system.account(iamroot.address)).nonce
  let counter = 0
  let promises = []
  for (let oldTX of extrinsics) {
    counter += 1
    if (typeof CallIndices[oldTX.method] !== "undefined") {
      let tx = CallIndices[oldTX.method](...oldTX.args)

      nonce = new BN(1).add(nonce)
      promises.push(sendAsSudo(api, iamroot, oldTX.oldSigner, tx, nonce))
    }
    if (promises.length >= PARALLEL) {
      // TODO: wait until any promise is done and remove done promises.
      await Promise.all(promises)
      promises = []
    }
  }
  console.log(`\n\nResurrected ${counter} transactions! May the dark node have mercy!`)
  return api
}

async function connect() {
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
  return api
}

connect().then(replayExtrinsics).then((api) => {
  api.disconnect()
  console.log("OK BYE!")
}).catch((err) => {
  console.log("BAD THING!\n\n", err)
})
