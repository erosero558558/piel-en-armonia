const fs = require('fs');
const path = require('path');

const methodsDb = require('../methods.json');
const basePath = path.join(__dirname, '../lib/clinical_history');

function sanitizeCode(code) {
    // Replace 'privatefunction' -> 'public function '
    return code.replace(/(private|protected|public)\s*function/gi, 'public function ');
}

// 1. Generate Services
const services = ['ClinicalHistorySessionService', 'ClinicalHistoryDocumentService', 'ClinicalHistoryValidationService'];

for (const svc of services) {
    const metas = methodsDb[svc] || [];
    let methodsCode = '';
    
    for (const m of metas) {
        methodsCode += '\n' + sanitizeCode(m.code) + '\n';
    }

    const classContent = `<?php
declare(strict_types=1);

class ${svc}
{
    private ClinicalHistoryService $facade;
    private ClinicalHistoryAIService $ai;

    public function __construct(ClinicalHistoryService $facade, ClinicalHistoryAIService $ai)
    {
        $this->facade = $facade;
        $this->ai = $ai;
    }

    public function __call(string $name, array $args)
    {
        return $this->facade->invokeServiceMethod($name, $args);
    }
${methodsCode}
}
`;
    fs.writeFileSync(path.join(basePath, svc + '.php'), classContent);
}

// 2. Generate Facade
let facadeMethods = '';
let facadeInvokerMap = '';

for (const svc of services) {
    const metas = methodsDb[svc] || [];
    for (const m of metas) {
        // Collect explicit wrappers for original PUBLIC methods (to satisfy IDE/Reflection)
        if (m.visibility === 'public') {
            // we need the signature out of m.code
            const sigMatch = m.code.match(/public\s+function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(:\s*[a-zA-Z0-9_\\]+\s*)?\{/);
            if (sigMatch) {
                const funcName = sigMatch[1];
                const argsRaw = sigMatch[2];
                const retType = sigMatch[3] || '';
                
                // Extract variable names to pass down
                const argNames = [];
                const argRegex = /\$([a-zA-Z0-9_]+)/g;
                let match;
                while((match = argRegex.exec(argsRaw)) !== null) {
                    argNames.push('$' + match[1]);
                }
                
                let callParams = argNames.join(', ');
                let svcProp = svc === 'ClinicalHistorySessionService' ? 'sessionService' : 
                              svc === 'ClinicalHistoryDocumentService' ? 'documentService' : 'validationService';
                
                facadeMethods += `
    public function ${funcName}(${argsRaw})${retType}
    {
        return $this->${svcProp}->${funcName}(${callParams});
    }
`;
            }
        }
        
        // Map all methods (public and previously private) for the dynamic invoker
        let svcProp = svc === 'ClinicalHistorySessionService' ? 'sessionService' : 
                      svc === 'ClinicalHistoryDocumentService' ? 'documentService' : 'validationService';
        facadeInvokerMap += `        if (method_exists($this->${svcProp}, $name)) return $this->${svcProp}->$name(...$args);\n`;
    }
}

const facadeContent = `<?php
declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../telemedicine/ClinicalMediaService.php';
require_once __DIR__ . '/ClinicalHistorySessionService.php';
require_once __DIR__ . '/ClinicalHistoryDocumentService.php';
require_once __DIR__ . '/ClinicalHistoryValidationService.php';

final class ClinicalHistoryService
{
    private ClinicalHistoryAIService $ai;

    public ClinicalHistorySessionService $sessionService;
    public ClinicalHistoryDocumentService $documentService;
    public ClinicalHistoryValidationService $validationService;

    public function __construct(?ClinicalHistoryAIService $ai = null)
    {
        $this->ai = $ai ?? new ClinicalHistoryAIService();
        $this->sessionService = new ClinicalHistorySessionService($this, $this->ai);
        $this->documentService = new ClinicalHistoryDocumentService($this, $this->ai);
        $this->validationService = new ClinicalHistoryValidationService($this, $this->ai);
    }

    public function invokeServiceMethod(string $name, array $args)
    {
${facadeInvokerMap}
        throw new \BadMethodCallException("Método no encontrado en delegación de dominio Clínico: " . $name);
    }

    public function __call(string $name, array $args)
    {
        return $this->invokeServiceMethod($name, $args);
    }
${facadeMethods}
}
`;

fs.writeFileSync(path.join(basePath, 'ClinicalHistoryService.php'), facadeContent);
console.log('Servicios y Facade generados exitosamente.');
