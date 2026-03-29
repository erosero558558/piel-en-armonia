'use strict';

const ADMIN_QUEUE_UI_SUITES = [
    {
        id: 'admin_queue_guidance_live_ops',
        label: 'Admin queue guidance live ops',
        spec: 'tests/admin-queue-guidance-live-ops.spec.js',
        serverEngine: 'node',
    },
    {
        id: 'admin_queue_reception_escalation',
        label: 'Admin queue reception escalation',
        spec: 'tests/admin-queue-reception-escalation.spec.js',
        serverEngine: 'node',
    },
    {
        id: 'admin_queue_controls_numpad',
        label: 'Admin queue controls numpad',
        spec: 'tests/admin-queue-controls-numpad.spec.js',
        serverEngine: 'node',
    },
    {
        id: 'admin_queue_pilot_governance',
        label: 'Admin queue pilot governance',
        spec: 'tests/admin-queue-pilot-governance.spec.js',
        serverEngine: 'node',
    },
    {
        id: 'admin_queue_ops_hub',
        label: 'Admin queue ops hub',
        spec: 'tests/admin-queue-ops-hub.spec.js',
        serverEngine: 'node',
    },
];

function buildAdminQueueSuiteArgs(suite) {
    return [suite.spec, '--workers=1'];
}

module.exports = {
    ADMIN_QUEUE_UI_SUITES,
    buildAdminQueueSuiteArgs,
};
