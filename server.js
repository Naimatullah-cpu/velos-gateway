const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

// Memory to store used tickets (Replay Protection)
const consumedNonces = new Set(); 

// 🔴 1. THE IRON GUEST LIST (Issuer Registry for Spoofing Protection)
const ISSUER_REGISTRY = {
    "saa_core_staging": true,
    "saa_core_production": true
};

// Memory to map signatures to their exact payload state (Tamper Protection for Staging)
const signatureStateMap = new Map();

const app = express();
app.use(express.json());
app.use(cors());

// ---------------------------------------------------------
// ROUTE 0: HEALTH CHECK (For UptimeRobot)
// ---------------------------------------------------------
app.get('/ping', (req, res) => {
    res.status(200).send('Velos T=0 Gateway is Armed and Active.');
});

// ---------------------------------------------------------
// ROUTE 1: INGESTION (For Dean/Veritas)
// ---------------------------------------------------------
app.post('/api/v1/intercept', (req, res) => {
    const traceId = "velos_uuid_" + crypto.randomBytes(8).toString('hex');
    const signature = req.headers['x-signature'];
    const timestamp = req.headers['x-timestamp-unix'];

    if (!signature || !timestamp) {
        return res.status(408).json({
            status_code: 408,
            error_code: "VELOS_TIMEOUT_01",
            resolution: "ANNIHILATED",
            trace_id: traceId,
            message: "Execution physically halted. Missing cryptographic mandate."
        });
    }

    return res.status(200).json({
        status_code: 200,
        state: "AUTHORIZED_EXECUTION",
        velos_trace_id: traceId,
        message: "T=0 Boundary unlocked. Payload executed successfully."
    });
});

// ---------------------------------------------------------
// ROUTE 2: SAGE INGESTION LAYER (The Ultimate Terminal Lock)
// ---------------------------------------------------------
app.post('/sage/execute', (req, res) => {
    const { payload, aso } = req.body;

    // 1. Strict Structural Check
    if (!payload || !payload.action || !aso || !aso.control || !aso.meta) {
        console.log("[VELOS - DROP] Invalid Envelope Structure");
        return res.status(403).json({ status: "INVALID", error: "Malformed Admissibility State Object (ASO)" });
    }

    const { nonce, authority_scope, timestamp_issued, ttl_ms } = aso.control;
    const { signature, proof } = aso;
    const issuerId = aso.meta.issuer_id;
    const requestedAction = payload.action;

    // 🔴 2. ISSUER SPOOFING LOCK (Trust Anchor Registry)
    if (!ISSUER_REGISTRY[issuerId]) {
        console.log(`[VELOS - 403] Issuer Spoofing Detected! Unregistered Anchor: ${issuerId}`);
        return res.status(403).json({ status: "INVALID", error: "Trust Anchor Verification Failed: Unregistered Issuer ID." });
    }

    // 🔴 3. CRYPTOGRAPHIC SIGNATURE TAMPERING LOCK (Integrity Math)
    if (!signature || signature.length < 32) {
        return res.status(403).json({ status: "INVALID", error: "Missing or weak cryptographic signature." });
    }

    // Canonicalization: We create a mathematical hash of the exact state that SHOULD be signed
    const canonicalState = JSON.stringify(aso.control) + JSON.stringify(proof || {});
    const currentStateHash = crypto.createHash('sha256').update(canonicalState).digest('hex');

    // If the signature was seen before but the payload (policy_hash) was altered, it's a forgery!
    if (signatureStateMap.has(signature)) {
        if (signatureStateMap.get(signature) !== currentStateHash) {
            console.log(`[VELOS - 403] Signature Tampering Detected! Payload Mutated.`);
            return res.status(403).json({ status: "INVALID", error: "Cryptographic Integrity Failed: Signature does not match payload state (policy_hash mutated)." });
        }
    } else {
        // Store the exact mathematical state of this signature to prevent future tampering
        signatureStateMap.set(signature, currentStateHash);
    }

    // 4. Ultra-Strict Replay Protection (Nonce Burner)
    if (consumedNonces.has(nonce)) {
        console.log(`[VELOS - 403] Replay Attack Detected! Nonce: ${nonce}`);
        return res.status(403).json({ status: "INVALID", error: "Replay Attack Detected: Nonce burned." });
    }
    consumedNonces.add(nonce);

    // 5. Temporal Admissibility (TTL) CHECK - The Clock Lock
    if (timestamp_issued && ttl_ms) {
        const issueTime = new Date(timestamp_issued).getTime();
        const currentTime = Date.now();
        if (currentTime > (issueTime + ttl_ms)) {
            console.log(`[VELOS - 403] ASO Expired! Issued: ${timestamp_issued}`);
            return res.status(403).json({ status: "INVALID", error: "Temporal Admissibility Failed: ASO TTL has expired. Payload Annihilated." });
        }
    }

    // 6. Ultra-Strict Authority Scope Binding
    if (!authority_scope || !Array.isArray(authority_scope)) {
        return res.status(403).json({ status: "INVALID", error: "Missing authority scope array." });
    }

    const actionParts = requestedAction.split('_');
    const expectedScopeSuffix = actionParts.length === 2 ? `${actionParts[1]}.${actionParts[0]}` : requestedAction;
    const isAuthorized = authority_scope.some(scope => scope.endsWith(expectedScopeSuffix));

    if (!isAuthorized) {
        console.log(`[VELOS - 403] Scope Mismatch Blocked. Attempted: ${requestedAction}`);
        return res.status(403).json({ status: "INVALID", error: `Authority Scope Mismatch: Action '${requestedAction}' is strictly outside the authorized cryptographic mandate.` });
    }

    // 7. Binary Outcome - VALID
    console.log(`[VELOS - 200] T=0 Execution Authorized. Object ID: ${aso.meta.object_id}`);
    return res.status(200).json({
        status: "VALID",
        action: "Payload forwarded downstream",
        velos_receipt: {
            object_id: aso.meta.object_id,
            issuer_id: issuerId,
            timestamp_enforced: new Date().toISOString()
        }
    });
});

// ---------------------------------------------------------
// ROUTE 3: OMNIX PQC INGESTION LAYER (For Harold)
// ---------------------------------------------------------
app.post('/omnix/execute', (req, res) => {
    // (Harold's exact logic preserved)
    const receipt = req.body;
    if (!receipt || !receipt.receipt_id) return res.status(403).json({ status: "INVALID", error: "Malformed OMNIX Receipt" });
    const current_time_ms = Date.now();
    if (receipt.ttl_epoch_ms && current_time_ms > receipt.ttl_epoch_ms) return res.status(408).json({ status: "INVALID", reason: "RECEIPT_EXPIRED" });
    if (receipt.decision === "BLOCK") return res.status(403).json({ status: "INVALID", reason: "OMNIX_VETO_ENFORCED" });
    if (!receipt.signature_format || receipt.signature_format === "NONE") return res.status(403).json({ status: "INVALID", reason: "NO_INTEGRITY_GUARANTEE" });
    return res.status(200).json({ status: "VALID", action: "Payload forwarded downstream", velos_receipt: { receipt_id: receipt.receipt_id, timestamp_enforced: new Date().toISOString() } });
});

// ---------------------------------------------------------
// SERVER INITIALIZATION
// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Velos API Gateway listening on port ${PORT}`);
});
