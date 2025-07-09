CREATE TABLE utxos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    txid VARCHAR(100) NOT NULL,
    vout INT NOT NULL,
    address VARCHAR(100) NOT NULL,
    amount BIGINT NOT NULL,
    -- in satoshis
    script_pub_key TEXT NOT NULL,
    status ENUM('unspent', 'spent', 'pending') NOT NULL,
    spent_in_txid VARCHAR(100),
    confirmations INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY utxo_unique (txid, vout),
    INDEX status_index (status),
    INDEX address_index (address)
);