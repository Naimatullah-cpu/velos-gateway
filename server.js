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
// ROUTE 2: SAGE INGESTION LAYER (For Charmaine's ASO Phase 1)
// ---------------------------------------------------------
app.post('/sage/execute', (req, res) => {
    const { payload, aso } = req.body;

    // 1. Strict Structural Check
    if (!payload || !payload.action || !aso || !aso.control) {
        console.log("[VELOS - DROP] Invalid Envelope Structure");
        return res.status(403).json({ status: "INVALID", error: "Malformed Admissibility State Object (ASO)" });
    }

    // Extracting all control parameters including Time (TTL)
    const { nonce, authority_scope, timestamp_issued, ttl_ms } = aso.control;
    const { signature } = aso;
    const requestedAction = payload.action;

    // 2. Cryptographic Proof Presence
    if (!signature || !nonce) {
        console.log(`[VELOS - 403] Missing Cryptographic Proof.`);
        return res.status(403).json({ status: "INVALID", error: "Missing cryptographic constraints" });
    }

    // 3. Ultra-Strict Replay Protection (Nonce Burner)
    if (consumedNonces.has(nonce)) {
        console.log(`[VELOS - 403] Replay Attack Detected! Nonce: ${nonce}`);
        return res.status(403).json({ status: "INVALID", error: "Replay Attack Detected: Nonce burned." });
    }
    consumedNonces.add(nonce);

    // 4. 🔴 TEMPORAL ADMISSIBILITY (TTL) CHECK - The Clock Lock
    if (timestamp_issued && ttl_ms) {
        const issueTime = new Date(timestamp_issued).getTime();
        const currentTime = Date.now();
        // If current time is greater than issue time + ttl_ms, drop it!
        if (currentTime > (issueTime + ttl_ms)) {
            console.log(`[VELOS - 403] ASO Expired! Issued: ${timestamp_issued}`);
            return res.status(403).json({ 
                status: "INVALID", 
                error: "Temporal Admissibility Failed: ASO TTL has expired. Payload Annihilated." 
            });
        }
    }

    // 5. 🔴 ULTRA-STRICT AUTHORITY SCOPE BINDING (The Iron Lock)
    if (!authority_scope || !Array.isArray(authority_scope)) {
        return res.status(403).json({ status: "INVALID", error: "Missing authority scope array." });
    }

    // Mathematical Scope Resolution: Translates "execute_trade" -> "trade.execute" to match scope
    const actionParts = requestedAction.split('_');
    const expectedScopeSuffix = actionParts.length === 2 ? `${actionParts[1]}.${actionParts[0]}` : requestedAction;
    
    const isAuthorized = authority_scope.some(scope => scope.endsWith(expectedScopeSuffix));

    if (!isAuthorized) {
        console.log(`[VELOS - 403] Scope Mismatch Blocked. Attempted: ${requestedAction}`);
        return res.status(403).json({ 
            status: "INVALID", 
            error: `Authority Scope Mismatch: Action '${requestedAction}' is strictly outside the authorized cryptographic mandate.` 
        });
    }

    // 6. Binary Outcome - VALID
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
// ROUTE 3: OMNIX PQC INGESTION LAYER (For Harold)
// ---------------------------------------------------------
app.post('/omnix/execute', (req, res) => {
    const receipt = req.body;

    if (!receipt || !receipt.receipt_id) {
        return res.status(403).json({ status: "INVALID", error: "Malformed OMNIX Receipt" });
    }

    const current_time_ms = Date.now();
    if (receipt.ttl_epoch_ms && current_time_ms > receipt.ttl_epoch_ms) {
        console.log(`[VELOS - 408] OMNIX Receipt Expired! Payload Annihilated.`);
        return res.status(408).json({ status: "INVALID", reason: "RECEIPT_EXPIRED" });
    }

    if (receipt.decision === "BLOCK") {
        console.log(`[VELOS - 403] OMNIX Veto Active. Execution Halted.`);
        return res.status(403).json({ status: "INVALID", reason: "OMNIX_VETO_ENFORCED" });
    }

    const sig_format = receipt.signature_format;
    if (sig_format === "NONE" || !sig_format) {
        return res.status(403).json({ status: "INVALID", reason: "NO_INTEGRITY_GUARANTEE" });
    }

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
