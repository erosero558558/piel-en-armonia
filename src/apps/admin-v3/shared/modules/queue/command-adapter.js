let queueCommandAdapter = null;

export function setQueueCommandAdapter(adapter) {
    queueCommandAdapter =
        adapter && typeof adapter === 'object' ? adapter : null;
    return queueCommandAdapter;
}

export function getQueueCommandAdapter() {
    return queueCommandAdapter;
}

export function clearQueueCommandAdapter() {
    queueCommandAdapter = null;
}
