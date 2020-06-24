# tx-necromancer

**Read transactions from an old chain and replay them in the same order with the sudo-module on a new chain.**

- The new chain may not have the same state as the old chain.
- All transactions have a newer timestamp than the original ones.
- The transactions may also be in a block with different transactions than before.
- If the transactions depend on a blocknumber or timestamp, replaying them might not be as easy.
- The balance of all accounts might also not be accurate since transactions fees are not deduced from their account but from the authority account?

If you want to read all transactions from a chain, make sure to start a local full node and read all tx from this node.
This will speed up the script by a lot.

# Usage

This repository contains two simple scripts.

1. The `read-tx` script reads all transactions and writes them to a csv file.
2. The `write-tx` script reads the csv file from the first step and replays all transactions on a new chain.

There may be changes that require that the arguments to the transactions are updated.

## 1. Read transactions from old chain - `read-tx`

Before you start the script, I recommend to **start a full node and connect to the old chain**.
That way you have a local synced node that already has all the transactions.
Then, You can connect to your local node and read all transactions from there.
This is way faster than querying the blocks from a remote node and also reduced the workload for remote nodes.

Note that the transactions in the csv file are in **reverse order**, e.g. the newest transaction is the top most line.
However, the `write-tx` **script needs the transactions in the opposite order**.
Therefore, use

```bash
tail -r extrinsics.csv > ../write-tx/reversed_tx.csv
```

### Example: How to run a full node with mashnet-node

Build the node to get the `mashnet-node` executable, use the respective chain-spec and set the base path for the database (`--base-path`):

#### Dev-net

```
./mashnet-node --chain ./PATH_TO/chainspec.devnet.json --bootnodes /ip4/3.122.51.250/tcp/30333/p2p/QmR627o6Sj2smbqh3XSuP11YzThuBz3QTDz2QMYwB9oo8U --ws-port 9944 --ws-external --rpc-external --base-path db
```

#### Prod-net

```
./mashnet-node --port 30333 --chain ./PATH_TO/chainspec.json --bootnodes /ip4/18.197.29.177/tcp/30333/p2p/QmTKngF1X4Zawh5Zi5sUq6F6o1NQbTPFnrXY8QpfpnkstH --base-path db
```

## 2. Transfer transactions to new chain - `write-tx`

Before you start, you **might** need to set up a couple things. After that you can start the script.

1. The [path to the file containing all transactions](write-tx/index.ts#L8) (_default: `./reversed_tx.csv` generated [above](./README.md#L35)_),
2. To which [node to connect to](write-tx/index.ts#L9) (_default: `ws://127.0.0.1:9945`_),
3. Your [custom chain types](write-tx/index.ts#L160) (_default: from KILT mashnet node 2.0.0-rc3_),
4. The [root authority mnemonic](write-tx/index.ts#L10) (_default: `//Alice`_) and
5. The [keyring type of your root authority](write-tx/index.ts#L107) (_default: `ed25519`_).

In some cases simply replaying the script is not enough.
E.g. if the signature encoding changed, all old signatures need to be adjusted for the new chain.
The transactions themselves are not signed on the new chain.
Only signatures that are passed over to a method call need to be adjusted.

If the **genesis block changed**, the **transactions need to change** as well.
E.g. if there is a faucet account and the address for that account changed, all fund transfers need to be adjusted.

**IMPORTANT**: The transaction fee is not deduced for the transactions!
This means that the balance of all accounts is not accurate!
The _[dump-balance.ts](./write-tx/dump-balance.ts)_ should give you an idea how to do that.
However, reading the balance from the old chain is currently missing.
