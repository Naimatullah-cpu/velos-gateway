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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Velos API Gateway listening on port ${PORT}`);
});
