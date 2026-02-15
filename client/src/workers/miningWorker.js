// SHA-256 Mining Web Worker
// Runs hash computation off the main thread so UI stays responsive

let mining = false;
let blockNumber = 0;
let telegramId = '';
let targetDifficulty = 4;
let nonce = 0;
let hashCount = 0;
let startTime = 0;

// Convert ArrayBuffer to hex string
function bufferToHex(buffer) {
    const bytes = new Uint8Array(buffer);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

// Main mining loop
async function mineLoop(throttle = 0) {
    const targetPrefix = '0'.repeat(targetDifficulty);
    const encoder = new TextEncoder();
    const batchSize = 500; // Hashes per batch before yielding

    while (mining) {
        for (let i = 0; i < batchSize; i++) {
            const input = `${blockNumber}:${nonce}:${telegramId}`;
            const data = encoder.encode(input);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hash = bufferToHex(hashBuffer);
            hashCount++;
            nonce++;

            // Check if hash meets difficulty
            if (hash.startsWith(targetPrefix)) {
                // Found a valid hash!
                self.postMessage({
                    type: 'found',
                    hash,
                    nonce: nonce - 1, // The nonce that produced this hash
                    hashCount,
                    elapsed: Date.now() - startTime
                });
                mining = false;
                return;
            }
        }

        // Report progress every batch
        const elapsed = (Date.now() - startTime) / 1000;
        const hashrate = elapsed > 0 ? Math.round(hashCount / elapsed) : 0;

        self.postMessage({
            type: 'progress',
            hashCount,
            nonce,
            hashrate,
            elapsed: Math.round(elapsed)
        });

        // Yield to allow message processing (and throttle if requested)
        await new Promise(resolve => setTimeout(resolve, throttle));
    }
}

// Handle messages from main thread
self.onmessage = function (e) {
    const { type, data } = e.data;

    switch (type) {
        case 'start':
            blockNumber = data.blockNumber;
            telegramId = data.telegramId;
            targetDifficulty = data.targetDifficulty;
            const throttle = data.throttle || 0; // ms delay per batch

            nonce = Math.floor(Math.random() * 1000000); // Random start nonce
            hashCount = 0;
            startTime = Date.now();
            mining = true;

            self.postMessage({ type: 'started', startNonce: nonce });
            mineLoop(throttle);
            break;

        case 'stop':
            mining = false;
            self.postMessage({
                type: 'stopped',
                hashCount,
                elapsed: Date.now() - startTime
            });
            break;
    }
};
