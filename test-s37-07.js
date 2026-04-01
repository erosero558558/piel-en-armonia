const { execSync } = require('child_process');

// Base 64 string of a minimal valid PDF (%PDF-1.4\nEOF)
const pdfBase64 = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R /Size 3 >>\n%%EOF\n').toString('base64');

const payload = JSON.stringify({
    session_id: 'fake_sess_id',
    order_id: 'img_test_77',
    type: 'eco',
    findings: 'No abnormalities detected in epidermis',
    impression: 'Normal skin scan',
    study_date: '2026-04-01',
    file_base64: pdfBase64
});

console.log("Testing POST receive-imaging-result...");
try {
    const out = execSync(`php -r "
        \$_SERVER['REQUEST_METHOD'] = 'POST';
        \$_GET['resource'] = 'receive-imaging-result';
        \$_SESSION['admin_email'] = 'test@example.com';
        \$context = ['isAdmin' => true, 'resource' => 'receive-imaging-result', 'method' => 'POST'];
        function require_json_body() { return json_decode('${payload}', true); }
        require_once 'lib/common.php';
        require_once 'controllers/ClinicalHistoryController.php';
        ClinicalHistoryController::handle(\$context);
    "`, { encoding: 'utf8' });
    console.log("Output:\\n", out);
} catch (e) {
    console.log("Failed:", e.stdout ? e.stdout.toString() : e.message);
}
