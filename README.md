# tx-necromancer

Read transactions from an old chain and replay them in the same order with the sudo-module on a new chain.

The new chain may not have the same state as the old chain.
All transactions have a newer timestamp than the original ones.
The transactions may also be in a block with different transactions than before.
If the transactions depend on a blocknumber or timestamp, replaying them might not be as easy.

If you want to read all transactions from a chain, make sure to start a local full node and read all tx from this node.
This speeds up the script by a lot.
