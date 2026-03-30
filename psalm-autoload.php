<?php

declare(strict_types=1);

use Composer\Autoload\ClassLoader;

if (!class_exists(ClassLoader::class, false)) {
    require __DIR__ . '/vendor/composer/ClassLoader.php';
}

$loader = new ClassLoader();

$psr4 = require __DIR__ . '/vendor/composer/autoload_psr4.php';
foreach ($psr4 as $prefix => $paths) {
    $loader->setPsr4($prefix, $paths);
}

$psr0 = require __DIR__ . '/vendor/composer/autoload_namespaces.php';
foreach ($psr0 as $prefix => $paths) {
    $loader->set($prefix, $paths);
}

$classMap = require __DIR__ . '/vendor/composer/autoload_classmap.php';
$loader->addClassMap($classMap);
$loader->register();

return $loader;
