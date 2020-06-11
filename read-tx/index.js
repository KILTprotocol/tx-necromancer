const { ApiPromise, WsProvider } = require("@polkadot/api")
const { cryptoWaitReady } = require("@polkadot/util-crypto")
const util = require("@polkadot/util")
const fs = require("fs")

const OUT_FILE = "extrinsics.csv"
const START_BLOCK_NUM = undefined
const NODE_ADDRESS = "ws://127.0.0.1:9944"

const CallIndices = {
  "0x0000": "Timestamp",
  "0x0300": "Transfer",
  "0x0500": "CreateCtype",
  "0x0600": "CreateAttestation",
  "0x0601": "RevokeClaim",
  "0x0700": "CreateDelegationRoot",
  "0x0701": "AddDelegation",
  "0x0800": "AddDID",
  "0x0801": "RemoveDID",
};

function toCSVRow(tx) {
  let args = JSON.stringify(tx.method.args)
  return `${tx.method.sectionName};${tx.method.methodName};${tx.signer};${args}`
}

async function scrapeExtrinsics(api) {
  console.log("ready")

  let latestBlockHash
  if (START_BLOCK_NUM !== undefined) {
    latestBlockHash = await api.rpc.chain.getBlockHash(START_BLOCK_NUM);
  } else {
    latestBlockHash = await api.rpc.chain.getBlockHash();
  }
  const bigBlock = await api.rpc.chain.getBlock(latestBlockHash);
  let block = bigBlock.block
  console.log(JSON.stringify(block))

  for (let i = Number(block.header.number); i > 0; i--) {
    const { extrinsics } = block;

    extrinsics.filter((extrinsic) => {
      const method = util.u8aToHex(extrinsic.method.callIndex)
      return CallIndices[method] !== "Timestamp"
    }).forEach((extrinsic) => {
      fs.appendFileSync(OUT_FILE, toCSVRow(extrinsic) + '\n');
      process.stdout.write(".")
    });
      // Set the new block as this one's parent.
      block = (await api.rpc.chain.getBlock(block.header.parentHash)).block;
  }
  console.log(block)
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

connect().then(scrapeExtrinsics).then((api) => {
  api.disconnect()
  console.log("OK BYE!")
}).catch((err) => {
  console.log("BAD THING!\n\n", err)
})
