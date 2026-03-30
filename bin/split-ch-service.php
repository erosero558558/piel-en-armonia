<?php
$sourceFile = __DIR__ . '/../lib/clinical_history/ClinicalHistoryService.php';
$source = file_get_contents($sourceFile);

// Parse all methods
$tokens = token_get_all($source);
$methods = [];
$currentMethod = null;
$braceCount = 0;
$inMethod = false;

$methodStr = '';
$captureDocBlock = '';
$methodName = '';
$visibility = '';

for ($i = 0; $i < count($tokens); $i++) {
    $token = $tokens[$i];
    
    // Capture docblocks before method
    if (is_array($token) && $token[0] === T_DOC_COMMENT && !$inMethod) {
        $captureDocBlock = $token[1] . "\n";
    }
    
    if (!$inMethod) {
        if (is_array($token) && ($token[0] === T_PUBLIC || $token[0] === T_PRIVATE || $token[0] === T_PROTECTED)) {
            // Might be a method, check if 'function' follows
            $vis = $token[1];
            $lookAhead = $i + 1;
            while(isset($tokens[$lookAhead]) && is_array($tokens[$lookAhead]) && $tokens[$lookAhead][0] === T_WHITESPACE) $lookAhead++;
            
            if (isset($tokens[$lookAhead]) && is_array($tokens[$lookAhead]) && $tokens[$lookAhead][0] === T_FUNCTION) {
                // It is a method!
                $inMethod = true;
                $braceCount = 0;
                $methodStr = $captureDocBlock . $vis;
                $visibility = $vis;
                $captureDocBlock = '';
                
                // Find name
                $nameAhead = $lookAhead + 1;
                while(isset($tokens[$nameAhead]) && is_array($tokens[$nameAhead]) && $tokens[$nameAhead][0] === T_WHITESPACE) $nameAhead++;
                if (isset($tokens[$nameAhead]) && is_array($tokens[$nameAhead]) && $tokens[$nameAhead][0] === T_STRING) {
                    $methodName = $tokens[$nameAhead][1];
                }
                
                $i = $lookAhead - 1; // skip forward
                continue;
            } else {
                $captureDocBlock = ''; // properties
            }
        }
    } else {
        if (is_string($token)) {
            $methodStr .= $token;
            if ($token === '{') {
                $braceCount++;
            } elseif ($token === '}') {
                $braceCount--;
                if ($braceCount === 0) {
                    // Method ended!
                    $methods[$methodName] = [
                        'name' => $methodName,
                        'visibility' => $visibility,
                        'code' => $methodStr
                    ];
                    $inMethod = false;
                    $methodStr = '';
                }
            }
        } else {
            $methodStr .= $token[1];
        }
    }
}

echo "Found " . count($methods) . " methods.\n";

$services = [
    'ClinicalHistorySessionService' => [],
    'ClinicalHistoryDocumentService' => [],
    'ClinicalHistoryValidationService' => []
];

// Mapping rules based on naming or domain
foreach ($methods as $name => $meta) {
    if ($name === '__construct') continue; // Skip constructor

    if (stripos($name, 'view') !== false || stripos($name, 'review') !== false || stripos($name, 'audit') !== false || stripos($name, 'consent') !== false || stripos($name, 'compliance') !== false || stripos($name, 'legal') !== false || stripos($name, 'guardrail') !== false || stripos($name, 'applyClinicalApproval') !== false) {
        $services['ClinicalHistoryValidationService'][] = $meta;
    } elseif (stripos($name, 'export') !== false || stripos($name, 'document') !== false || stripos($name, 'pdf') !== false || stripos($name, 'copy') !== false || stripos($name, 'delivery') !== false) {
        $services['ClinicalHistoryDocumentService'][] = $meta;
    } else {
        $services['ClinicalHistorySessionService'][] = $meta; // Fallback to session (largest)
    }
}

echo "Session: " . count($services['ClinicalHistorySessionService']) . "\n";
echo "Document: " . count($services['ClinicalHistoryDocumentService']) . "\n";
echo "Validation: " . count($services['ClinicalHistoryValidationService']) . "\n";

file_put_contents('methods.json', json_encode($services, JSON_PRETTY_PRINT));
