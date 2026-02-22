<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/storage.php';

class MLService {
    private string $pythonPath = 'python3';
    private string $scriptsDir;
    private string $modelPath;
    private string $dbPath;

    public function __construct(?string $scriptsDir = null, ?string $modelPath = null, ?string $dbPath = null) {
        // Use absolute paths
        $defaultScriptsDir = realpath(__DIR__ . '/../ml');
        $this->scriptsDir = $scriptsDir ?: ($defaultScriptsDir ?: '');
        $this->modelPath = $modelPath ?: (data_dir_path() . '/models/noshow_model.pkl');
        $this->dbPath = $dbPath ?: data_file_path();
    }

    public function trainModel(): array {
        if (!$this->scriptsDir || !file_exists($this->scriptsDir . '/train_model.py')) {
            return ['success' => false, 'error' => 'Training script not found'];
        }

        // Ensure model directory exists
        $modelDir = dirname($this->modelPath);
        if (!is_dir($modelDir)) {
            if (!mkdir($modelDir, 0775, true) && !is_dir($modelDir)) {
                return ['success' => false, 'error' => 'Could not create model directory'];
            }
        }

        $cmd = escapeshellcmd($this->pythonPath) . ' ' .
               escapeshellarg($this->scriptsDir . '/train_model.py') . ' ' .
               '--db-path ' . escapeshellarg($this->dbPath) . ' ' .
               '--model-path ' . escapeshellarg($this->modelPath) . ' 2>&1';

        $output = [];
        $returnVar = 0;
        exec($cmd, $output, $returnVar);

        return [
            'success' => $returnVar === 0,
            'output' => implode("\n", $output),
            'model_path' => $this->modelPath
        ];
    }

    public function predictNoShow(array $appointmentData): ?float {
        if (!file_exists($this->modelPath)) {
            // Model not trained yet
            return null;
        }

        if (!$this->scriptsDir || !file_exists($this->scriptsDir . '/predict.py')) {
            error_log("ML Service: predict.py not found.");
            return null;
        }

        $inputJson = json_encode($appointmentData);
        if ($inputJson === false) {
            return null;
        }

        $cmd = escapeshellcmd($this->pythonPath) . ' ' .
               escapeshellarg($this->scriptsDir . '/predict.py') . ' ' .
               '--model-path ' . escapeshellarg($this->modelPath);

        $descriptorspec = [
            0 => ["pipe", "r"],  // stdin
            1 => ["pipe", "w"],  // stdout
            2 => ["pipe", "w"]   // stderr
        ];

        $process = proc_open($cmd, $descriptorspec, $pipes);

        if (is_resource($process)) {
            fwrite($pipes[0], $inputJson);
            fclose($pipes[0]);

            $stdout = stream_get_contents($pipes[1]);
            fclose($pipes[1]);

            $stderr = stream_get_contents($pipes[2]);
            fclose($pipes[2]);

            $return_value = proc_close($process);

            if ($return_value === 0 && is_string($stdout)) {
                $result = json_decode($stdout, true);
                if (is_array($result) && isset($result['probability'])) {
                    return (float)$result['probability'];
                }
                if (is_array($result) && isset($result['error'])) {
                    error_log("ML Prediction error from script: " . $result['error']);
                }
            } else {
                 error_log("ML Prediction process failed: " . $stderr);
            }
        }

        return null;
    }

    public function getModelPath(): string {
        return $this->modelPath;
    }
}
