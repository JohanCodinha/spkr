// =============================================================================
// CONNECTION STATUS - Beacon indicator for connection state
// =============================================================================

let beaconEl = null;

export function initConnectionStatus() {
    beaconEl = document.getElementById('connection-beacon');
}

export function setAdvertising() {
    if (!beaconEl) return;
    beaconEl.classList.remove('connected');
    beaconEl.classList.add('advertising');
}

export function setConnected() {
    if (!beaconEl) return;
    beaconEl.classList.remove('advertising');
    beaconEl.classList.add('connected');
}

export function updatePeerCount(count) {
    // Update beacon based on peer count
    if (count > 0) {
        setConnected();
    } else {
        setAdvertising();
    }
}

export function reset() {
    if (beaconEl) {
        beaconEl.classList.remove('advertising', 'connected');
    }
}
