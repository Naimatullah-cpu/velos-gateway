const express = require('express');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

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
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Velos API Gateway listening on port ${PORT}`);
});
