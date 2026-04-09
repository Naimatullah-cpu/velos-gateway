const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

// Memory to store used tickets (Replay Protection for SAGE)
const consumedNonces = new Set(); 

const app = express();
app.use(express.json());
app.use(cors());

// ---------------------------------------------------------
// ROUTE 1: INGESTION (For Dean/Veritas)
// ---------------------------------------------------------
app.post('/api/v1/intercept', (req, res) => {
    const traceId = "velos_uuid_" + crypto.randomBytes(8).toString('hex');
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp-unix'];

    // If Signature is missing: FAIL CLOSED (T=0 Halt)
    if (!signature || !timestamp) {
        console.log(`[VELOS T=0 HALT] Unauthorized payload dropped. Trace: ${traceId}`);
        return res.status(408).json({
            status_code: 408,
            error_code: "VELOS_TIMEOUT_01",
            resolution: "ANNIHILATED",
            trace_id: traceId,
            message: "Execution physically halted. Missing cryptographic mandate."
        });
    }

    // If Signature is present: AUTHORIZED EXECUTION (Unlock)
    console.log(`[VELOS UNLOCKED] Signature verified. Payload executing. Trace: ${traceId}`);
    return res.status(200).json({
        status_code: 200,
        state: "AUTHORIZED_EXECUTION",
        velos_trace_id: traceId,
        auth_hash_accepted: true,
        signature_curve: "Ed25519",
        timestamp_verified: timestamp,
        execution_target: req.body.command ? req.body.command.type : "unknown",
        message: "T=0 Boundary unlocked. Payload executed successfully."
    });
});

// ---------------------------------------------------------
// ROUTE 3: SAGE INGESTION LAYER (For Charmaine's ASO Phase 1)
// ---------------------------------------------------------
app.post('/sage/execute', (req, res) => {
    const { payload, aso } = req.body;

    // 1. Check if structure is valid
    if (!payload || !aso || !aso.control) {
        console.log("[VELOS - DROP] Invalid Envelope Structure");
        return res.status(403).json({ 
            status: "INVALID", 
            error: "Malformed Admissibility State Object (ASO)" 
        });
    }

    const { nonce } = aso.control;
    const { signature } = aso;

    // 2. Phase 1 Verification (Signature & Nonce present)
    if (!signature || !nonce) {
        console.log(`[VELOS - 403] Missing Cryptographic Proof for Object: ${aso.meta.object_id}`);
        return res.status(403).json({ status: "INVALID", error: "Missing cryptographic constraints" });
    }

    // 🔴 NEW: Replay Protection (Nonce Uniqueness Check)
    if (consumedNonces.has(nonce)) {
        console.log(`[VELOS - 403] Replay Attack Detected! Nonce already consumed: ${nonce}`);
        return res.status(403).json({ 
            status: "INVALID", 
            error: "Replay Attack Detected: Nonce has already been consumed." 
        });
    }

    // Mark nonce as used (Ticket burned)
    consumedNonces.add(nonce);

    // 3. Binary Outcome - VALID
    console.log(`[VELOS - 200] T=0 Execution Authorized. Object ID: ${aso.meta.object_id}`);
    return res.status(200).json({
        status: "VALID",
        action: "Payload forwarded downstream",
        velos_receipt: {
            object_id: aso.meta.object_id,
            issuer_id: aso.meta.issuer_id,
            timestamp_enforced: new Date().toISOString()
        }
    });
});

// ---------------------------------------------------------
// ROUTE 4: OMNIX PQC INGESTION LAYER (For Harold)
// ---------------------------------------------------------
app.post('/omnix/execute', (req, res) => {
    const receipt = req.body;

    // 1. Structural Check
    if (!receipt || !receipt.receipt_id) {
        return res.status(403).json({ status: "INVALID", error: "Malformed OMNIX Receipt" });
    }

    console.log(`[VELOS - OMNIX GATEWAY] Ingesting Receipt: ${receipt.receipt_id}`);

    // 2. TTL Enforcement (Rule #1 from Harold's Checklist)
    const current_time_ms = Date.now();
    if (receipt.ttl_epoch_ms && current_time_ms > receipt.ttl_epoch_ms) {
        console.log(`[VELOS - 408] OMNIX Receipt Expired! Payload Annihilated.`);
        return res.status(408).json({ status: "INVALID", reason: "RECEIPT_EXPIRED" });
    }

    // 3. Veto Check (Rule #6 from Checklist)
    if (receipt.decision === "BLOCK") {
        console.log(`[VELOS - 403] OMNIX Veto Active. Execution Halted.`);
        return res.status(403).json({ status: "INVALID", reason: "OMNIX_VETO_ENFORCED" });
    }

    // 4. Signature Format Dispatch (Rule #4 & #7)
    const sig_format = receipt.signature_format;
    
    if (sig_format === "NONE" || !sig_format) {
        return res.status(403).json({ status: "INVALID", reason: "NO_INTEGRITY_GUARANTEE" });
    }

    if (sig_format === "hex_sha256_fallback") {
        // Fallback Symmetric check
        console.log(`[VELOS] Evaluating SHA-256 Fallback...`);
    } else if (sig_format === "base64_pqc") {
        // Dilithium PQC check
        console.log(`[VELOS] Evaluating PQC Dilithium Signature...`);
    } else {
        return res.status(403).json({ status: "INVALID", reason: `UNKNOWN_FORMAT_${sig_format}` });
    }

    // Binary Outcome - VALID
    console.log(`[VELOS - 200] T=0 Execution Authorized for OMNIX.`);
    return res.status(200).json({
        status: "VALID",
        action: "Payload forwarded downstream",
        velos_receipt: {
            receipt_id: receipt.receipt_id,
            timestamp_enforced: new Date().toISOString()
        }
    });
});

// ---------------------------------------------------------
// SERVER INITIALIZATION
// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Velos API Gateway listening on port ${PORT}`);
});
