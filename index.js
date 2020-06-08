const { ApiPromise, WsProvider } = require("@polkadot/api")
const { cryptoWaitReady } = require("@polkadot/util-crypto")
const util = require("@polkadot/util")
const fs = require("fs")

const OUTFILE = "extrinsics.json"
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
};

function humanReadable(tx) {
  const method = util.u8aToHex(tx.method.callIndex)
  let args = JSON.parse(JSON.stringify(tx.method.args))

  return {
    "method": CallIndices[method] || method,
    "signer": tx.signer,
    "args": args,
  }
}

async function scrapeExtrinsics() {
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

  let allTXs = []

  for (let i = Number(block.header.number); i > 0; i--) {
    const { extrinsics } = block;
    console.log(`Scraping ${block.extrinsics.length} extrinsics at block ${block.header.number}.`);

    extrinsics.filter((extrinsic) => {
      const method = util.u8aToHex(extrinsic.method.callIndex)
      return CallIndices[method] !== "Timestamp"
    }).forEach((extrinsic) => {
      console.dir(extrinsic, { depth: null });
      console.log("TX", humanReadable(extrinsic))
      allTXs.push(humanReadable(extrinsic))
      // Set the new block as this one's parent.
    });
    block = (await api.rpc.chain.getBlock(block.header.parentHash)).block;
  }
  allTXs = allTXs.reverse()
  const outTXs = JSON.stringify(allTXs)
  console.log("Write TXs", outTXs)

  fs.writeFile(OUTFILE, outTXs, (err) => {
    if (err) return console.log(err)
    else console.log("All went well.")
  })
}

scrapeExtrinsics().then(() => {
  console.log("OK BYE!")
}, (err) => {
  console.log("BAD THING!\n\n", err)
}).finally()
