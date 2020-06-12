import { ApiPromise, WsProvider, Keyring } from "@polkadot/api"
import { cryptoWaitReady } from "@polkadot/util-crypto"
import * as util from "@polkadot/util"
import * as fs from "fs"
import BN = require('bn.js/')
import * as readline from 'readline'

const IN_FILE = "reversed_tx.csv"
const NODE_ADDRESS = "ws://127.0.0.1:9945"
const MNEMONIC = "//Alice"
const NEW_FAUCET = "5HTEzvVT5bQxJTYPiDhRUw4GHarQVs66sFQEpQDUNT6MyoJr"
const OLD_FAUCET = "5DQvFncZBQAep5586L5CqYb8QK6TYXUosgpnRRdiywNmAGjp"

const PARALLEL = 1000

const SIG_TYPE_ED25519 = new Uint8Array([0]);

enum SYSTEM_EVENTS {
  ExtrinsicSuccess = '0x0000',
  ExtrinsicFailed = '0x0001',
}

function id(args) {return args}

function updateSig(signature) {
  return util.u8aConcat(
    SIG_TYPE_ED25519,
    signature
  )
}

function replaceFaucet(sourceAddress: string) {
  if (sourceAddress === OLD_FAUCET) return NEW_FAUCET
  else return sourceAddress
}

function mapArg(argNum: number, mapper: (arg0: any) => any) {
  return (args: any[]) => {
    if (args.length >= argNum) args[argNum] = mapper(args[argNum])
    return args
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
    api.tx.sudo.sudoAs(oldSigner, tx).signAndSend(iamroot, {nonce}, result => {
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

const ArgMapper = {
  "balances.transfer": mapArg(1, (arg) => 5),
  "ctype.add": id,
  "attestation.add": id,
  "attestation.revoke": id,
  "delegation.createRoot": id,
  "delegation.addDelegation": mapArg(5, updateSig),
  "delegation.revokeDelegation": id,
  "did.add": id,
  "did.remove": id,
}

const SenderMapper = {
  "balances.transfer": replaceFaucet,
  "ctype.add": id,
  "attestation.add": id,
  "attestation.revoke": id,
  "delegation.createRoot": id,
  "delegation.addDelegation": id,
  "delegation.revokeDelegation": id,
  "did.add": id,
  "did.remove": id,
}

async function replayExtrinsics(api) {
  const keyring = new Keyring({ type: 'ed25519' })
  const iamroot = keyring.addFromUri(MNEMONIC)

  if (iamroot.address !== (await api.query.sudo.key()).toString()) {
    console.log(`Got key: ${iamroot.address}, but ${(await api.query.sudo.key()).toString()} is root`)
    throw Error("This is not the secret for the Sudo key.")
  }

  console.log("May the finalized swim once again in the pool of living, to be compiled, authored and, once again, finalized.")

  const fileStream = fs.createReadStream(IN_FILE)
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })

  let nonce = (await api.query.system.account(iamroot.address)).nonce
  let counter = 0
  let promises = []
  for await (const line of rl) {
    const [module, method, oldSigner, rawArgs] = line.split(';')
    const args = JSON.parse(rawArgs)
    counter += 1
    const apiMod = api.tx[module]![method]
    const methodName = `${module}.${method}`
    if (typeof apiMod !== 'undefined' && typeof ArgMapper[methodName] !== 'undefined') {
      let mappedArgs = ArgMapper[methodName](args)
      let mappedSender = SenderMapper[methodName](oldSigner)
      let tx = apiMod(...mappedArgs)

      promises.push(sendAsSudo(api, iamroot, mappedSender, tx, nonce))
      nonce = new BN(1).add(nonce)
      process.stdout.write(".")
    } else {
      process.stdout.write("-")
    }
    if (promises.length >= PARALLEL) {
      // TODO: wait until any promise is done and remove done promises.
      await Promise.all(promises)
      promises = []
    }
  }
  await Promise.all(promises)
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
