const secp256k1 = require('secp256k1')
const ethUtils = require('ethereumjs-util')
const rlp = require('rlp')
const { randomBytes } = require('crypto')
const { BN } = require('openzeppelin-test-helpers')

// CREATE2 address is calculated this way:
// keccak("0xff++msg.sender++salt++keccak(byteCode)")
async function genCreate2Address(identityHash, registry) {
    const byteCode = (await registry.getProxyCode())
    const salt = `0x${'0'.repeat(64-identityHash.length+2)}${identityHash.replace(/0x/, '')}`
    return `0x${web3.utils.keccak256(`0x${[
        'ff',
        registry.address.replace(/0x/, ''),
        salt.replace(/0x/, ''),
        web3.utils.keccak256(byteCode).replace(/0x/, '')
    ].join('')}`).slice(-40)}`.toLowerCase()
}

function generatePrivateKey() {
    let privKey
    do {
      privKey = randomBytes(32)
    } while (!secp256k1.privateKeyVerify(privKey))

    return privKey
}

function privateToPublic(privKey) {
    return ethUtils.privateToPublic(privKey)
}

function toAddress(pubKey) {
    const hash = ethUtils.keccak(pubKey).slice(-20)
    return `0x${hash.toString('hex')}`
}

// Returns signature as 65 bytes Buffer in format of `r` (32 bytes), `s` (32 bytes), `v` (1 byte)
function signMessage(message, privKey) {
    const messageHash = ethUtils.keccak(message)
    const sigObj = secp256k1.sign(messageHash, privKey)
    return Buffer.concat([
        sigObj.signature, 
        Buffer.from((sigObj.recovery + 27).toString(16), 'hex')
    ])
    
    // Alternative implementatino using ethereumjs-util
    // const { r, s, v } = ethUtils.ecsign(messageHash, privKey)
    // return Buffer.from([r.toString('hex'), s.toString('hex'), v.toString(16)].join(''), 'hex')
}

function verifySignature(message, signature, pubKey) {
    if (pubKey.length >= 64 && pubKey[0].toString(16) !== '04') {
        // pubkey = Buffer.from(`04${pubKey.toString('hex')}`, 'hex')
        pubKey = Buffer.concat([Buffer.from('04', 'hex'), pubKey])
    }

    const messageHash = ethUtils.keccak(message)
    return secp256k1.verify(messageHash, signature.slice(0, 64), pubKey)
}

// Derive address of smart contract created by creator.
function deriveContractAddress(creator, nonce = 0) {
    const input = [ creator, nonce ]
    const rlp_encoded = rlp.encode(input)
    return toAddress(rlp_encoded)
}

// Topup given amount of ethers into give to address
async function topUpEthers(from, to, value) {
    const initialBalance = new BN(await web3.eth.getBalance(to))
    await web3.eth.sendTransaction({from, to, value})

    const expectedBalance = initialBalance.add(new BN(value.toString()))
    expect(await web3.eth.getBalance(to)).to.be.equal(expectedBalance.toString())
}

// Mint some tokens into expected dexAddress
async function topUpTokens(token, to, amount) {
     await token.mint(to, amount.toString())

     const expectedBalance = await token.balanceOf(to)
     expectedBalance.should.be.bignumber.equal(amount.toString())
}

module.exports = { 
    genCreate2Address,
    generatePrivateKey,
    privateToPublic,
    getIdentityHash: toAddress,
    signMessage,
    verifySignature,
    deriveContractAddress,
    topUpEthers,
    topUpTokens,
    keccak: ethUtils.keccak,
    setLengthLeft: ethUtils.setLengthLeft
}