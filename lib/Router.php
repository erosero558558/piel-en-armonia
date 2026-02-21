<?php

declare(strict_types=1);

class Router
{
    private $routes = [];

    public function add(string $method, string $resource, callable $handler, string $version = 'v1'): void
    {
        $this->routes[$version][strtoupper($method)][$resource] = $handler;
    }

    public function dispatch(string $method, string $resource, string $version, array $context): void
    {
        $method = strtoupper($method);

        // Strict version check
        if (!isset($this->routes[$version])) {
            json_response(['ok' => false, 'error' => "Version '$version' not supported"], 400);
        }

        // Check for specific method and resource
        if (isset($this->routes[$version][$method][$resource])) {
            call_user_func($this->routes[$version][$method][$resource], $context);
            return;
        }

        // If strict versioning is desired, we stop here.
        // For now, we return 404 if not found in the requested version.
        json_response([
            'ok' => false,
            'error' => 'Ruta no soportada'
        ], 404);
    }
}
