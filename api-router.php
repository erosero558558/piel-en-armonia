<?php

declare(strict_types=1);

class Router
{
    private $routes = [];

    public function add(string $method, string $resource, callable $handler): void
    {
        $this->routes[strtoupper($method)][$resource] = $handler;
    }

    public function get(string $resource, callable $handler): void
    {
        $this->add('GET', $resource, $handler);
    }

    public function post(string $resource, callable $handler): void
    {
        $this->add('POST', $resource, $handler);
    }

    public function put(string $resource, callable $handler): void
    {
        $this->add('PUT', $resource, $handler);
    }

    public function patch(string $resource, callable $handler): void
    {
        $this->add('PATCH', $resource, $handler);
    }

    public function dispatch(string $method, string $resource, array $context): bool
    {
        $method = strtoupper($method);
        if (isset($this->routes[$method][$resource])) {
            call_user_func($this->routes[$method][$resource], $context);
            return true;
        }
        return false;
    }
}
