const fs = require('fs');
const path = require('path');

const repoPath = path.join(__dirname, '../lib/clinical_history/ClinicalHistoryRepository.php');
let sourceCode = fs.readFileSync(repoPath, 'utf8');

const methods = [];

// Since JS regex might not handle nested brackets well, we use a manual scanner.
// A simpler scanner than PHP token_get_all, but robust enough.
let pos = 0;
while (true) {
    // Find the next public/private static function
    const match = sourceCode.substring(pos).match(/(?:(\/\*\*[\s\S]*?\*\/)\s*)?(public|private)\s+static\s+function\s+([a-zA-Z0-9_]+)\s*\((.*?)\)(?:\s*:\s*([^\{]+))?\s*\{/);
    if (!match) break;
    
    const startIndex = pos + match.index;
    const bodyStart = startIndex + match[0].length - 1; // position of '{'
    
    let braceCount = 0;
    let i = bodyStart;
    let inString = false;
    let stringChar = '';
    
    for (; i < sourceCode.length; i++) {
        const char = sourceCode[i];
        
        // Very basic string skipping
        if ((char === '"' || char === "'") && sourceCode[i-1] !== '\\') {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (stringChar === char) {
                inString = false;
            }
        }
        
        if (!inString) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
            
            if (braceCount === 0) {
                break;
            }
        }
    }
    
    const endIndex = i + 1;
    const methodRaw = sourceCode.substring(startIndex, endIndex);
    
    // Normalize visibility to public
    let newCode = methodRaw.replace(/(?:public|private)\s+static\s+function/g, 'public static function');
    
    methods.push({
        name: match[3],
        originalVisibility: match[2],
        docblock: match[1] || '',
        argsMapRaw: match[4] || '',
        returnTypeRaw: match[5] ? match[5].trim() : '',
        code: newCode
    });
    
    pos = endIndex;
}

console.log('Found', methods.length, 'methods.');

const services = {
    'ClinicalHistoryEvolutionRepository': [],
    'ClinicalHistoryPrescriptionRepository': [],
    'ClinicalHistoryDiagnosisRepository': [],
    'ClinicalHistorySessionRepository': []
};

for (const m of methods) {
    const name = m.name.toLowerCase();
    
    if (name.includes('evolution') || name.includes('hcu005') || name.includes('note') || name.includes('live') || name.includes('impression') || name.includes('plan')) {
        services['ClinicalHistoryEvolutionRepository'].push(m);
    } 
    else if (name.includes('prescription') || name.includes('medication')) {
        services['ClinicalHistoryPrescriptionRepository'].push(m);
    }
    else if (name.includes('diagnosis') || name.includes('diagnoses') || name.includes('cie10') || name.includes('diagnostic')) {
        services['ClinicalHistoryDiagnosisRepository'].push(m);
    }
    else {
        services['ClinicalHistorySessionRepository'].push(m);
    }
}

const outDir = path.join(__dirname, '../lib/clinical_history');

for (const svc in services) {
    console.log(svc, services[svc].length);
    let classContent = `<?php\n\ndeclare(strict_types=1);\n\nrequire_once __DIR__ . '/../common.php';\n\nfinal class ${svc}\n{\n`;
    for (const m of services[svc]) {
        classContent += '\n' + m.code.split('\n').map(l => '    ' + l).join('\n') + '\n';
    }
    classContent += `}\n`;
    fs.writeFileSync(path.join(outDir, svc + '.php'), classContent);
}

// Generate the Facade
let facadeContent = `<?php\n\ndeclare(strict_types=1);\n\nrequire_once __DIR__ . '/../common.php';\nrequire_once __DIR__ . '/ClinicalHistorySessionRepository.php';\nrequire_once __DIR__ . '/ClinicalHistoryEvolutionRepository.php';\nrequire_once __DIR__ . '/ClinicalHistoryPrescriptionRepository.php';\nrequire_once __DIR__ . '/ClinicalHistoryDiagnosisRepository.php';\n\nfinal class ClinicalHistoryRepository\n{\n`;

for (const svc in services) {
    for (const m of services[svc]) {
        // Extract arg names for the forward call
        const argNames = [];
        const argRegex = /\\$([a-zA-Z0-9_]+)/g;
        let match;
        while((match = argRegex.exec(m.argsMapRaw)) !== null) {
            argNames.push('$' + match[1]);
        }
        
        let callParams = argNames.join(', ');
        let returnType = m.returnTypeRaw ? `: ${m.returnTypeRaw}` : '';
        
        let docStr = m.docblock ? m.docblock + '\n    ' : '';
        let wrapper = `
    ${docStr}public static function ${m.name}(${m.argsMapRaw})${returnType}
    {
        return ${svc}::${m.name}(${callParams});
    }
`;
        facadeContent += wrapper;
    }
}
facadeContent += `}\n`;
fs.writeFileSync(repoPath, facadeContent);

console.log('Done!');
