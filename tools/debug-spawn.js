const { spawnSync } = require('child_process');
const focus = require('./agent-orchestrator/domain/focus.js');
console.log(focus.resolveNpmProgram ? "yes" : "no");
