# tx-necromancer

Read transactions from an old chain and replay them in the same order with the sudo-module on a new chain.

The new chain may not have the same state as the old chain.
All transactions have a newer timestamp than the original ones.
The transactions may also be in a block with different transactions than before.
If the transactions depend on a blocknumber or timestamp, replaying them might not be as easy.
The balance of all accounts might also not be accurate since transactions fees are not deduced from their account but from the authority account?


If you want to read all transactions from a chain, make sure to start a local full node and read all tx from this node.
This speeds up the script by a lot.

# Usage

This repository contains two simple scripts.
The `read-tx` script reads all transactions and writes them to a JSON file.
`write-tx` reads the JSON file and replays all transactions on a new chain.
there may be changes that require that the arguments to the transactions are updated.

## read-tx

Before you start the script, i recommend to start a full node and connect to the old chain.
That way you have a local synced node that already has all the transactions.
You can then connect to your local node and read all transactions from there.
This is way faster than querying the blocks from a remote node and also reduced the workload for remote nodes.

Currently all transactions are stored in memory.
This could lead to problems if there are more transactions than space in memory.

## write-tx

Before you start you need to set up the path to the file which contains all transactions, to which node to connect and the root authority mnemonic.
After that you can start the script.
Please note that there is no rate limiting for the transactions.
