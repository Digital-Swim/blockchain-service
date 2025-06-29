import * as bitcoin from 'bitcoinjs-lib'
import { signSchnorr } from '@bitcoinerlab/secp256k1'

const network = bitcoin.networks.regtest
const OPS = bitcoin.script.OPS

const data = {
    address: "bcrt1pf4druktlmdyxp3pfkk270hcm42gcx4tkh287tcv2mr4jjxvl3axq2ehl7v",
    seckey: "3f7a8f6dcce1dc90c24ebad6771a631b6e27b1a675b8650d52bec749e9adee33",
    tapleaf: "5f8b14423b09e1dfa396b686ff56812a18826e61d2dc6fc19a8636f4ff9f32a7",
    script: [
        "55699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa",
        "OP_CHECKSIG",
        "OP_0",
        Buffer.from([111, 114, 100]),
        Buffer.from([1]),
        Buffer.from("746578742f706c61696e", "hex"),
        "OP_0",
        Buffer.from("48656c6c6f2c20426974636f696e204f7264696e616c732066726f6d2047656d696e6921", "hex"),
        "OP_ENDIF"
    ],
    cblock: "c155699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa",
    pubkey: "55699dcafdf511b4ae7ac85e0261e5dd357a564557c2436144e75f515d2119aa"
}

// Compile script
const script = data.script.map(item => {
    if (typeof item === 'string') {
        if (item.startsWith('OP_')) return OPS[item]
        return Buffer.from(item, 'hex')
    }
    return item
})

const compiledScript = bitcoin.script.compile(script)
const pubkeyBuffer = Buffer.from(data.pubkey, 'hex')
const controlBlock = Buffer.from(data.cblock, 'hex')

// UTXO
const utxo = {
    txid: "1b803b600332980d06cc0ad642977dc43022b2f590aaf9f883289e4ab3dd0b6d",
    vout: 1,
    value: 1e8,
    scriptPubKey: Buffer.from("51204d5a3e597fdb4860c429b595e7df1baa91835576ba8fe5e18ad8eb29199f8f4c", 'hex')
}

// PSBT
const psbt = new bitcoin.Psbt({ network })

psbt.addInput({
    hash: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
        script: utxo.scriptPubKey,
        value: utxo.value
    },
    tapLeafScript: [{
        leafVersion: 0xc0,
        script: compiledScript,
        controlBlock
    }]
})

psbt.addOutput({
    address: "bcrt1q2u05us4wvf30smcwelnqhrq06jj02seqpfq9hk",
    value: 90000
})

// ⚠️ Use already compiled script, do NOT recompile
const tapLeafHash = bitcoin.crypto.taggedHash(
    'TapLeaf',
    Buffer.concat([
        Buffer.from([0xc0]),
        compiledScript
    ])
)

// Sign
const sighash = psbt.__CACHE.__TX.hashForWitnessV1(
    0,
    [utxo.scriptPubKey],
    [utxo.value],
    bitcoin.Transaction.SIGHASH_DEFAULT
)

const signature = signSchnorr(sighash, Buffer.from(data.seckey, 'hex'))

// Inject signature
psbt.updateInput(0, {
    tapScriptSig: [{
        pubkey: pubkeyBuffer,
        leafHash: tapLeafHash,
        signature: Buffer.from(signature)
    }]
})

// Finalize
psbt.finalizeInput(0)

const txHex = psbt.extractTransaction().toHex()
console.log("Reveal tx:", txHex)
