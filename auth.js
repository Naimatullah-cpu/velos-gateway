// auth.js - Cryptographic Signature Validation
const crypto = require('crypto');

// The Master Secret (In production, this is highly secured)
const VELOS_MASTER_KEY = "alpha_courtroom_secret_2026"; 

function verifyAuthHash(receiptId, providedHash) {
    // Generate the expected hash mathematically
    const expectedHash = crypto
        .createHmac('sha256', VELOS_MASTER_KEY)
        .update(receiptId)
        .digest('hex');

    // Compare provided hash with expected math
    return providedHash === expectedHash;
}

function generateSignature(receiptId) {
    // This is for your Courtroom UI to generate the valid hash
    return crypto
        .createHmac('sha256', VELOS_MASTER_KEY)
        .update(receiptId)
        .digest('hex');
}

module.exports = { verifyAuthHash, generateSignature };
