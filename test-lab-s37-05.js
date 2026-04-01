const { execSync } = require('child_process');
const fs = require('fs');

const runTest = () => {
    const payload = JSON.stringify({
        session_id: 'fake_sess_id_not_exist',
        lab_order_id: 'ord_123',
        result_date: '2026-04-01T12:00:00Z',
        lab_name: 'Test Lab',
        values: [
            { test_name: 'Hemoglobina', value: '7.1', unit: 'g/dL', status: 'critical' }
        ]
    });

    console.log("Testing invalid session id...");
    try {
        const out = execSync(`php -r "
            \$_SERVER['REQUEST_METHOD'] = 'POST';
            \$_GET['resource'] = 'receive-lab-result';
            \$_SESSION['admin_email'] = 'test@example.com';
            \$context = ['isAdmin' => true, 'resource' => 'receive-lab-result', 'method' => 'POST'];
            function require_json_body() { return json_decode('${payload}', true); }
            require_once 'lib/common.php';
            require_once 'controllers/ClinicalHistoryController.php';
            ClinicalHistoryController::handle(\$context);
        "`, { encoding: 'utf8' });
        console.log("Output:", out);
    } catch (e) {
        console.log("Failed (expected 404):", e.stdout.toString() || e.message);
    }
};

runTest();
