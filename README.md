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

The transactions in the csv file are in reverse order. The newest transaction is the top most line.
The write-tx script needs the transactions in the opposite order. (use `tail -r input.csv > reversed.csv`)


## write-tx

Before you start you need to set up the path to the file which contains all transactions, to which node to connect and the root authority mnemonic.
After that you can start the script.

In some cases simply replaying the script is not enough.
If e.g. the signature encoding changed, all old signatures need to be adjusted for the new chain.
The transactions them self are not signed on the new chain.
Only signatures that are passed over to a method call need to be adjusted.

If the genesis block changed the transactions need to change to.
E.g. if there is a faucet account and the address for that account changed, all fund transfers need to be adjusted.

IMPORTANT: The transaction fee is not deduced for the transactions! That means that the balance of all accounts is not accurate!
