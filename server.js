// server.js - Velos V1.0 API Gateway
const express = require('express');
const crypto = require('crypto');
const { freezePayload, checkPayloadState, releasePayload } = require('./redis');
const { verifyAuthHash } = require('./auth');

const app = express();
app.use(express.json());

// ---------------------------------------------------------
// ROUTE 1: INGESTION LAYER (For Habibu/Sentinel & Harold)
// ---------------------------------------------------------
app.post('/api/v1/intercept', async (req, res) => {
    const payload = req.body;
    const receiptId = "velos_uuid_" + crypto.randomBytes(8).toString('hex');

    // 1. Instantly freeze payload at T=0
    await freezePayload(receiptId, payload);
    console.log(`[VELOS GATEWAY] Payload intercepted. STATUS: HALTED. ID: ${receiptId}`);

    // 2. The Suspended Handoff (Long-Polling for 60 seconds)
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds

    const timer = setInterval(async () => {
        attempts++;
        const state = await checkPayloadState(receiptId);

        if (!state) {
            // TTL Expired - FAIL CLOSED
            clearInterval(timer);
            console.log(`[VELOS GATEWAY] TTL Expired. Dropping Payload. ID: ${receiptId}`);
            return res.status(408).json({
                status: "error",
                error_code: "VELOS_TIMEOUT_01",
                message: "Auth_Hash human signature window expired (TTL: 60s)",
                trace_id: receiptId
            });
        }

        if (state.status === 'APPROVED') {
            // Human injected the Auth_Hash - RELEASE PAYLOAD
            clearInterval(timer);
            console.log(`[VELOS GATEWAY] Auth_Hash Confirmed. Executing Payload. ID: ${receiptId}`);
            return res.status(200).json({
                status: "success",
                execution_state: "COMMITTED",
                receipt_id: receiptId,
                velos_auth_hash: state.auth_hash,
                original_payload: state.payload
            });
        }

        if (attempts >= maxAttempts) {
            clearInterval(timer);
            return res.status(408).json({ error: "Gateway Timeout" });
        }
    }, 1000); // Check every 1 second
});

// ---------------------------------------------------------
// ROUTE 2: THE COURTROOM UI (For Naimat to Approve)
// ---------------------------------------------------------
app.post('/api/v1/courtroom/approve', async (req, res) => {
    const { receipt_id, auth_hash } = req.body;

    // Validate the cryptographic signature
    if (!verifyAuthHash(receipt_id, auth_hash)) {
        return res.status(403).json({ error: "Invalid Cryptographic Signature. Access Denied." });
    }

    // Release the lock
    const released = await releasePayload(receipt_id, auth_hash);
    if (!released) {
        return res.status(404).json({ error: "Payload not found or TTL expired." });
    }

    res.json({ message: "Payload authorized and released to destination." });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 VELOS V1.0 T=0 GATEWAY LIVE ON PORT ${PORT}`);
    console.log(`Waiting for upstream payloads...`);
});
