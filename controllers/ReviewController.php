<?php

declare(strict_types=1);

class ReviewController
{
    public static function index(array $context): void
    {
        // GET /reviews
        $store = $context['store'];
        usort($store['reviews'], static function (array $a, array $b): int {
            return strcmp((string) ($b['date'] ?? ''), (string) ($a['date'] ?? ''));
        });
        json_response([
            'ok' => true,
            'data' => $store['reviews']
        ]);
    }

    public static function store(array $context): void
    {
        // POST /reviews
        $store = $context['store'];
        require_rate_limit('reviews', 3, 60);
        $payload = require_json_body();
        $review = normalize_review($payload);
        if ($review['name'] === '' || $review['text'] === '') {
            json_response([
                'ok' => false,
                'error' => 'Nombre y reseña son obligatorios'
            ], 400);
        }
        $store['reviews'][] = $review;
        write_store($store);
        json_response([
            'ok' => true,
            'data' => $review
        ], 201);
    }
}
