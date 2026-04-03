const payloadStore = new Map();
const TTL_SECONDS = 60; // Strict 60-second rule

async function freezePayload(receiptId, payload) {
    const data = {
        status: 'HALTED',
        payload: payload,
        timestamp: Date.now()
    };
    payloadStore.set(receiptId, data);

    setTimeout(() => {
        if (payloadStore.has(receiptId)) {
            const current = payloadStore.get(receiptId);
            if (current.status !== 'APPROVED') {
                payloadStore.delete(receiptId);
                console.log(`[VELOS] TTL Expired. Dropped ID: ${receiptId}`);
            }
        }
    }, TTL_SECONDS * 1000);

    return receiptId;
}

async function checkPayloadState(receiptId) {
    return payloadStore.get(receiptId) || null;
}

async function releasePayload(receiptId, authHash) {
    const data = payloadStore.get(receiptId);
    if (!data) return false; 

    data.status = 'APPROVED';
    data.auth_hash = authHash;
    payloadStore.set(receiptId, data);

    setTimeout(() => { payloadStore.delete(receiptId); }, 300000);
    return true;
}

module.exports = { freezePayload, checkPayloadState, releasePayload };
