const { ApiPromise, WsProvider } = require("@polkadot/api")
const { cryptoWaitReady } = require("@polkadot/util-crypto")
const util = require("@polkadot/util")
const fs = require("fs")

const OUT_FILE = "accounts.csv"
const NODE_ADDRESS = "ws://127.0.0.1:9945"

async function dumpBalance(api) {
  console.dir(api.query.system.account, {depth: 1})
  const exposures = await api.query.system.account.entries()
  exposures.forEach(([key, exposure]) => {
    fs.appendFileSync(OUT_FILE, `${key.args[0].toHuman()};${JSON.stringify(exposure.data)}\n`);
      process.stdout.write(".")
  })
  return api
}

async function connect() {
  console.log("Start")
  const wsProvider = new WsProvider(NODE_ADDRESS)
  const api = await ApiPromise.create({ provider: wsProvider, types: {
      DelegationNodeId: 'Hash',
      PublicSigningKey: 'Hash',
      PublicBoxKey: 'Hash',
      Permissions: 'u32',
      ErrorCode: 'u16',
    }
  })
  await cryptoWaitReady()
  return api
}

connect().then(dumpBalance).then((api) => {
  api.disconnect()
  console.log("OK BYE!")
}).catch((err) => {
  console.log("BAD THING!\n\n", err)
})
