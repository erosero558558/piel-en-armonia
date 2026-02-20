<?php
declare(strict_types=1);

/**
 * Metrics collection library for Prometheus.
 * Supports Redis (via Predis) and file-based fallback.
 */

class Metrics
{
    private static $client = null;
    private static $useRedis = null;
    private static $filePath = null;

    private static function init(): void
    {
        if (self::$useRedis !== null) {
            return;
        }

        $host = getenv('PIELARMONIA_REDIS_HOST');
        if (is_string($host) && trim($host) !== '' && class_exists('Predis\Client')) {
            try {
                self::$client = new \Predis\Client([
                    'scheme' => 'tcp',
                    'host'   => trim($host),
                    'port'   => 6379,
                    'read_write_timeout' => 2,
                ]);
                self::$client->connect();
                self::$useRedis = true;
                return;
            } catch (Exception $e) {
                error_log('Metrics: Redis connection failed, falling back to file. ' . $e->getMessage());
            }
        }

        self::$useRedis = false;
        self::$filePath = __DIR__ . '/../data/metrics.json';
        if (!is_dir(dirname(self::$filePath))) {
            @mkdir(dirname(self::$filePath), 0775, true);
        }
    }

    public static function increment(string $name, array $labels = [], int $value = 1): void
    {
        self::init();
        $key = self::buildKey($name, $labels);

        if (self::$useRedis) {
            try {
                self::$client->incrby('metrics:counter:' . $key, $value);
                // Track key for export
                self::$client->sadd('metrics:keys', 'metrics:counter:' . $key);
            } catch (Exception $e) {
                // Fail silently
            }
        } else {
            self::updateFile(function(array &$data) use ($key, $value) {
                if (!isset($data['counters'][$key])) {
                    $data['counters'][$key] = 0;
                }
                $data['counters'][$key] += $value;
            });
        }
    }

    public static function observe(string $name, float $value, array $labels = [], ?array $buckets = null): void
    {
        self::init();
        if ($buckets === null) {
            $buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
        }
        $key = self::buildKey($name, $labels);

        if (self::$useRedis) {
            try {
                $pipe = self::$client->pipeline();
                $pipe->incrby('metrics:histogram:' . $key . ':count', 1);
                $pipe->incrbyfloat('metrics:histogram:' . $key . ':sum', $value);

                // Track key
                self::$client->sadd('metrics:keys', 'metrics:histogram:' . $key);

                // Store buckets definition if customized
                // We use a set to store the unique bucket values (as strings)
                // This allows us to reconstruct the correct buckets in export()
                foreach ($buckets as $bucket) {
                    $pipe->sadd('metrics:histogram:' . $key . ':buckets', (string)$bucket);
                }

                foreach ($buckets as $bucket) {
                    if ($value <= $bucket) {
                        $bKey = str_replace('.', '_', (string)$bucket);
                        $pipe->incr('metrics:histogram:' . $key . ':bucket:' . $bKey);
                    }
                }
                $pipe->execute();
            } catch (Exception $e) {
                // Fail silently
            }
        } else {
            self::updateFile(function(array &$data) use ($key, $value, $buckets) {
                if (!isset($data['histograms'][$key])) {
                    $data['histograms'][$key] = [
                        'count' => 0,
                        'sum' => 0.0,
                        'buckets' => []
                    ];
                    foreach ($buckets as $b) {
                        $data['histograms'][$key]['buckets'][(string)$b] = 0;
                    }
                }

                $data['histograms'][$key]['count']++;
                $data['histograms'][$key]['sum'] += $value;

                foreach ($buckets as $bucket) {
                    if ($value <= $bucket) {
                        $bKey = (string)$bucket;
                        if (!isset($data['histograms'][$key]['buckets'][$bKey])) {
                            $data['histograms'][$key]['buckets'][$bKey] = 0;
                        }
                        $data['histograms'][$key]['buckets'][$bKey]++;
                    }
                }
            });
        }
    }

    private static function buildKey(string $name, array $labels): string
    {
        if (empty($labels)) {
            return $name;
        }
        ksort($labels);
        $parts = [];
        foreach ($labels as $k => $v) {
            $parts[] = $k . '="' . $v . '"';
        }
        return $name . '{' . implode(',', $parts) . '}';
    }

    private static function updateFile(callable $callback): void
    {
        $fp = @fopen(self::$filePath, 'c+');
        if ($fp && flock($fp, LOCK_EX)) {
            $content = stream_get_contents($fp);
            $data = $content ? json_decode($content, true) : ['counters' => [], 'histograms' => []];
            if (!is_array($data)) {
                $data = ['counters' => [], 'histograms' => []];
            }
            if (!isset($data['counters'])) $data['counters'] = [];
            if (!isset($data['histograms'])) $data['histograms'] = [];

            $callback($data);

            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, json_encode($data));
            fflush($fp);
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    public static function export(): string
    {
        self::init();
        $output = [];

        if (self::$useRedis) {
            try {
                $keys = self::$client->smembers('metrics:keys');
                sort($keys); // predictable output

                foreach ($keys as $k) {
                    if (strpos($k, 'metrics:counter:') === 0) {
                        $metricNameFull = substr($k, strlen('metrics:counter:'));
                        // metricNameFull is Name{labels} or Name
                        $metricName = explode('{', $metricNameFull)[0];
                        $val = self::$client->get($k);
                        $output[] = "# TYPE $metricName counter";
                        $output[] = "$metricNameFull $val";
                    } elseif (strpos($k, 'metrics:histogram:') === 0) {
                        $metricNameFull = substr($k, strlen('metrics:histogram:'));
                        $metricName = explode('{', $metricNameFull)[0];

                        $count = self::$client->get('metrics:histogram:' . $metricNameFull . ':count') ?? 0;
                        $sum = self::$client->get('metrics:histogram:' . $metricNameFull . ':sum') ?? 0;

                        $output[] = "# TYPE $metricName histogram";
                        $output[] = $metricNameFull . "_count " . $count;
                        $output[] = $metricNameFull . "_sum " . $sum;

                        // Retrieve dynamic buckets
                        $bucketVals = self::$client->smembers('metrics:histogram:' . $metricNameFull . ':buckets');
                        $buckets = [];
                        if (!empty($bucketVals)) {
                            foreach ($bucketVals as $bv) {
                                $buckets[] = (float)$bv;
                            }
                            sort($buckets);
                        } else {
                            // Fallback default
                            $buckets = [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
                        }

                        // Need to reconstruct labels for buckets
                        $labels = '';
                        if (strpos($metricNameFull, '{') !== false) {
                            $labels = substr($metricNameFull, strpos($metricNameFull, '{')); // {l=v,...}
                        }

                        foreach ($buckets as $b) {
                            $bKey = str_replace('.', '_', (string)$b);
                            $bVal = self::$client->get('metrics:histogram:' . $metricNameFull . ':bucket:' . $bKey) ?? 0;

                            if ($labels === '') {
                                $bucketLabels = "{le=\"$b\"}";
                            } else {
                                $bucketLabels = substr($labels, 0, -1) . ",le=\"$b\"}";
                            }
                            $output[] = $metricName . "_bucket$bucketLabels $bVal";
                        }
                        // +Inf
                        if ($labels === '') {
                            $infLabels = "{le=\"+Inf\"}";
                        } else {
                            $infLabels = substr($labels, 0, -1) . ",le=\"+Inf\"}";
                        }
                        $output[] = $metricName . "_bucket$infLabels " . $count;
                    }
                }
            } catch (Exception $e) {
                return "# Error exporting from Redis: " . $e->getMessage();
            }
        } else {
            // File based export
            // Read with shared lock
            $fp = @fopen(self::$filePath, 'r');
            $data = ['counters' => [], 'histograms' => []];
            if ($fp && flock($fp, LOCK_SH)) {
                $content = stream_get_contents($fp);
                if ($content) {
                    $decoded = json_decode($content, true);
                    if (is_array($decoded)) $data = $decoded;
                }
                flock($fp, LOCK_UN);
                fclose($fp);
            }

            if (isset($data['counters'])) {
                foreach ($data['counters'] as $key => $val) {
                    $metricName = explode('{', $key)[0];
                    $output[] = "# TYPE $metricName counter";
                    $output[] = "$key $val";
                }
            }

            if (isset($data['histograms'])) {
                foreach ($data['histograms'] as $key => $hData) {
                    $metricName = explode('{', $key)[0];
                    $labels = '';
                    if (strpos($key, '{') !== false) {
                        $labels = substr($key, strpos($key, '{'));
                    }

                    $output[] = "# TYPE $metricName histogram";
                    $output[] = $metricName . "_count$labels " . ($hData['count'] ?? 0);
                    $output[] = $metricName . "_sum$labels " . ($hData['sum'] ?? 0);

                    if (isset($hData['buckets'])) {
                        // Sort buckets by numeric key value to ensure order
                        uksort($hData['buckets'], function($a, $b) {
                            return (float)$a <=> (float)$b;
                        });

                        foreach ($hData['buckets'] as $le => $count) {
                            if ($labels === '') {
                                $bucketLabels = "{le=\"$le\"}";
                            } else {
                                $bucketLabels = substr($labels, 0, -1) . ",le=\"$le\"}";
                            }
                            $output[] = $metricName . "_bucket$bucketLabels $count";
                        }
                    }
                    if ($labels === '') {
                        $infLabels = "{le=\"+Inf\"}";
                    } else {
                        $infLabels = substr($labels, 0, -1) . ",le=\"+Inf\"}";
                    }
                    $output[] = $metricName . "_bucket$infLabels " . ($hData['count'] ?? 0);
                }
            }
        }

        return implode("\n", $output);
    }
}
