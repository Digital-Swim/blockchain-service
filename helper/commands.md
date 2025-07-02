
# Helper Command for bitcoin 
cd C:\Program Files\Bitcoin\daemon

# Run Bitocin node 
bitcoind -regtest

## Send 
bitcoin-cli -regtest sendtoaddress <address> 0.0001

## Mint a block after sending to confirm a transaction 
bitcoin-cli -regtest generatetoaddress 1 $(bitcoin-cli -regtest getnewaddress)
bitcoin-cli -regtest generatetoaddress 1 <wallet address>


## Mint at least 100 blocks to staart / confirmation needs min 100 block to be minted  
bitcoin-cli -regtest generatetoaddress 100 <wallet address>


# Send / Publish tx hex
bitcoin-cli -regtest sendrawtransaction <signed_hex>


### Wallet parameter (add this to commands to call through wallet) 
-rpcwallet=ranjit 


# Ordinals 
ord --regtest --bitcoin-rpc-username ranjit --bitcoin-rpc-password ranjit server

