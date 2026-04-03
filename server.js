const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { freezePayload, checkPayloadState, releasePayload } = require('./redis');
const { verifyAuthHash } = require('./auth');

const app = express();
app.use(express.json());
app.use(cors());

// ROUTE 1: INGESTION (For Habibu/Sentinel)
app.post('/api/v1/intercept', async (req, res) => {
    const payload = req.body;
    const receiptId = "velos_uuid_" + crypto.randomBytes(8).toString('hex');

    await freezePayload(receiptId, payload);
    console.log(`[VELOS GATEWAY] Payload intercepted. STATUS: HALTED. ID: ${receiptId}`);

    let attempts = 0;
    const maxAttempts = 60; // 60 seconds

    const timer = setInterval(async () => {
        attempts++;
        const state = await checkPayloadState(receiptId);

        if (!state) {
            clearInterval(timer);
            return res.status(408).json({
                status: "error",
                error_code: "VELOS_TIMEOUT_01",
                message: "Auth_Hash human signature window expired (TTL: 60s)",
                trace_id: receiptId
            });
        }

        if (state.status === 'APPROVED') {
            clearInterval(timer);
            return res.status(200).json({
                status: "success",
                execution_state: "COMMITTED",
                receipt_id: receiptId,
                velos_auth_hash: state.auth_hash
            });
        }

        if (attempts >= maxAttempts) {
            clearInterval(timer);
            return res.status(408).json({ error: "Gateway Timeout" });
        }
    }, 1000); 
});

// ROUTE 2: COURTROOM UI (For Naimat to Approve)
app.post('/api/v1/courtroom/approve', async (req, res) => {
    const { receipt_id, auth_hash } = req.body;
    if (!verifyAuthHash(receipt_id, auth_hash)) return res.status(403).json({ error: "Invalid Cryptographic Signature." });
    
    const released = await releasePayload(receipt_id, auth_hash);
    if (!released) return res.status(404).json({ error: "Payload not found or TTL expired." });
    res.json({ message: "Payload authorized." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 VELOS V1.0 T=0 GATEWAY LIVE ON PORT ${PORT}`);
});
