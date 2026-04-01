<?php

declare(strict_types=1);

class ReviewController
{
    public static function index(array $context): void
    {
        // GET /reviews
        $store = $context['store'];
        $reviews = isset($store['reviews']) && is_array($store['reviews']) ? $store['reviews'] : [];
        if (count($reviews) === 0 && function_exists('default_public_reviews_enabled') && default_public_reviews_enabled()) {
            $reviews = get_default_public_reviews();
            if (count($reviews) > 0) {
                $store['reviews'] = $reviews;
                write_store($store, false);
            }
        }

        $service = isset($_GET['service']) ? trim((string) $_GET['service']) : '';
        if ($service !== '') {
            $filtered = array_values(array_filter($reviews, static function(array $r) use ($service): bool {
                return isset($r['service']) && $r['service'] === $service && $r['service'] !== '';
            }));
            
            // Fallback: If no service-specific reviews exist, use all clinic reviews
            if (count($filtered) === 0) {
                $filtered = $reviews;
            }
            
            usort($filtered, static function (array $a, array $b): int {
                return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
            });
            
            $ratingSum = 0;
            $count = count($filtered);
            foreach ($filtered as $r) {
                $ratingSum += isset($r['rating']) ? (int) $r['rating'] : 5;
            }
            $rating = $count > 0 ? round($ratingSum / $count, 1) : 5.0;
            $latest = array_slice($filtered, 0, 3);
            
            json_response([
                'ok' => true,
                'data' => [
                    'rating' => $rating,
                    'count' => $count,
                    'latest' => $latest
                ]
            ]);
        }

        usort($reviews, static function (array $a, array $b): int {
            return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
        });
        json_response([
            'ok' => true,
            'data' => $reviews
        ]);
    }

    public static function store(array $context): void
    {
        // POST /reviews
        $store = $context['store'];
        require_rate_limit('reviews', 3, 60);
        $payload = require_json_body();
        // Security: ensure we generate a new ID for new reviews
        unset($payload['id']);
        $review = normalize_review($payload);
        if ($review['name'] === '' || $review['text'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Nombre y reseña son obligatorios'
            ], 400);
        }
        
        $lock = with_store_lock(static function () use ($review) {
            $store = read_store();
            $store['reviews'][] = $review;
            if (write_store($store, false)) {
                return ['ok' => true];
            }
            return ['ok' => false];
        });

        if (($lock['ok'] ?? false) !== true) {
             json_response(['ok' => false, 'error' => 'Error de concurrencia al guardar reseña'], 503);
        }

        json_response([
            'ok' => true,
            'data' => $review
        ], 201);
    }
}
