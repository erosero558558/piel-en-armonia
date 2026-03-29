const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cwd = '/Users/luciaguadalupecaizasanchez/Documents/GitHub/Aurora-Derm';
const nodeDir = path.dirname(process.execPath);
const candidate = path.join(
    nodeDir,
    process.platform === 'win32' ? 'npm.cmd' : 'npm'
);
const npmProgram = fs.existsSync(candidate) ? candidate : (process.platform === 'win32' ? 'npm.cmd' : 'npm');

console.log("npmProgram:", npmProgram);

function buildTaskCommandEnv(rootPath) {
    const currentPath = String(process.env.PATH || '').trim();
    const pathSegments = [];
    const nodeBin = path.resolve(
        rootPath,
        '.local',
        'tooling',
        'node',
        'current',
        'bin'
    );
    const shims = path.resolve(rootPath, '.local', 'tooling', 'shims');
    if (fs.existsSync(nodeBin)) {
        pathSegments.push(nodeBin);
    }
    if (fs.existsSync(shims)) {
        pathSegments.push(shims);
    }
    if (currentPath) {
        pathSegments.push(currentPath);
    }
    return {
        ...process.env,
        PATH: pathSegments.join(process.platform === 'win32' ? ';' : ':'),
    };
}

const env = buildTaskCommandEnv(cwd);
console.log("ENV PATH length:", env.PATH.length);

const result = spawnSync(npmProgram, ['run', 'test:agent:work-autopilot'], {
    cwd,
    env,
    encoding: 'utf8',
    shell: false,
});

console.log("status:", result.status);
console.log("error:", result.error);
console.log("stdout:", result.stdout);
console.log("stderr:", result.stderr);
