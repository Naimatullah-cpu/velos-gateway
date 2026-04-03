// redis.js - Velos Terminal State Management
const redis = require('redis');

// Redis Client Setup (Connecting to memory)
const redisClient = redis.createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

const TTL_SECONDS = 60; // Strict 60-second rule

async function freezePayload(receiptId, payload) {
    const data = {
        status: 'HALTED',
        payload: payload,
        timestamp: Date.now()
    };
    // Freeze state with 60 seconds TTL
    await redisClient.set(receiptId, JSON.stringify(data), { EX: TTL_SECONDS });
    return receiptId;
}

async function checkPayloadState(receiptId) {
    const data = await redisClient.get(receiptId);
    return data ? JSON.parse(data) : null;
}

async function releasePayload(receiptId, authHash) {
    const data = await checkPayloadState(receiptId);
    if (!data) return false; // Fail-closed if TTL expired

    // Update state to APPROVED
    data.status = 'APPROVED';
    data.auth_hash = authHash;
    await redisClient.set(receiptId, JSON.stringify(data), { EX: 300 }); // Keep log for 5 mins
    return true;
}

module.exports = { freezePayload, checkPayloadState, releasePayload };
