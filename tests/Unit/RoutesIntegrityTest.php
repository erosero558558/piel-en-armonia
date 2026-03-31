<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use ReflectionClass;

class RoutesIntegrityTest extends TestCase
{
    public function testAllRegisteredRoutesHaveValidControllersAndMethods(): void
    {
        $routesFile = __DIR__ . '/../../lib/routes.php';
        $this->assertFileExists($routesFile);

        $content = file_get_contents($routesFile);
        $this->assertIsString($content);

        // Pattern matches: $router->add('GET', 'resource', [ControllerClass::class, 'methodName']
        $pattern = '/\$router->add\s*\(\s*\'[A-Z]+\'\s*,\s*\'[^\']+\'\s*,\s*\[\s*([a-zA-Z0-9_]+)::class\s*,\s*\'([a-zA-Z0-9_]+)\'\s*\]/m';
        
        preg_match_all($pattern, $content, $matches, PREG_SET_ORDER);
        
        $this->assertNotEmpty($matches, 'Could not find any routes defined in routes.php');

        $errors = [];
        foreach ($matches as $match) {
            $classBaseName = $match[1];
            $methodName = $match[2];
            
            // Assume controllers are in the global namespace (loaded via autoloader or require)
            $classExists = class_exists($classBaseName) || class_exists('\\' . $classBaseName);
            
            if (!$classExists) {
                // Try scanning the controllers directory if not auto-loaded
                $controllerPath = __DIR__ . '/../../controllers/' . $classBaseName . '.php';
                if (file_exists($controllerPath)) {
                    require_once $controllerPath;
                    $classExists = class_exists($classBaseName);
                }
            }
            
            if (!$classExists) {
                $errors[] = "Controller class '$classBaseName' does not exist.";
                continue;
            }

            try {
                $reflection = new ReflectionClass($classBaseName);
                if (!$reflection->hasMethod($methodName)) {
                    $errors[] = "Method '$methodName' does not exist in controller '$classBaseName'.";
                } elseif (!$reflection->getMethod($methodName)->isPublic()) {
                    $errors[] = "Method '$methodName' in controller '$classBaseName' is not public.";
                }
            } catch (\ReflectionException $e) {
                $errors[] = "Reflection error on '$classBaseName': " . $e->getMessage();
            }
        }

        if (!empty($errors)) {
            $this->fail("Found dead endpoints in routes.php:\n" . implode("\n", array_unique($errors)));
        }
        
        $this->assertTrue(true); // Explicit assertion to ensure test strictly passes
    }
}
