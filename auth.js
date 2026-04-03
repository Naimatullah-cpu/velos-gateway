const crypto = require('crypto');
const VELOS_MASTER_KEY = "alpha_courtroom_secret_2026"; 

function verifyAuthHash(receiptId, providedHash) {
    const expectedHash = crypto.createHmac('sha256', VELOS_MASTER_KEY).update(receiptId).digest('hex');
    return providedHash === expectedHash;
}

function generateSignature(receiptId) {
    return crypto.createHmac('sha256', VELOS_MASTER_KEY).update(receiptId).digest('hex');
}

module.exports = { verifyAuthHash, generateSignature };
