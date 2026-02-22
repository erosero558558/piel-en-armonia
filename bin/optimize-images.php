<?php

// bin/optimize-images.php
// Script to generate responsive WebP/AVIF images, optimized originals, and LQIP placeholders.

$source_dir = 'images/src';
$target_dir = 'images/optimized';

// Configuration: Map prefixes to target widths
$config = [
    'hero-woman' => [400, 640, 800, 1024, 1200, 1344], // Extended for telemedicina.html
    'showcase-hero' => [640, 1024, 1400],
    'showcase-diagnostic' => [640, 800],
    'showcase-clinic' => [640, 800],
    'showcase-treatment' => [640, 900],
    'service-' => [400],
    'team-' => [500],
    'verification_failed' => [600],
];

// CLI Arguments
$options = getopt('', ['force']);
$force = isset($options['force']);

if (!extension_loaded('gd')) {
    die("Error: GD extension is required.\n");
}

if (!is_dir($target_dir)) {
    mkdir($target_dir, 0755, true);
}

function get_target_widths($filename, $config)
{
    foreach ($config as $prefix => $widths) {
        $clean_prefix = rtrim($prefix, '-');
        if (strpos($filename, $clean_prefix) === 0) {
            return $widths;
        }
    }
    return [];
}

function optimize_image($file_path, $target_dir, $target_widths, $force)
{
    $info = getimagesize($file_path);
    if (!$info) {
        return;
    }

    $mime = $info['mime'];
    $width = $info[0];
    $height = $info[1];
    $filename = pathinfo($file_path, PATHINFO_FILENAME);

    echo "Processing: $filename ($width x $height)\n";

    // Load image
    switch ($mime) {
        case 'image/jpeg':
            $image = imagecreatefromjpeg($file_path);
            break;
        case 'image/png':
            $image = imagecreatefrompng($file_path);
            imagealphablending($image, false);
            imagesavealpha($image, true);
            break;
        default:
            return;
    }

    if (!$image) {
        echo "Failed to load image: $file_path\n";
        return;
    }

    // 1. Generate Optimized Original (JPEG/PNG)
    $ext = ($mime === 'image/jpeg') ? 'jpg' : 'png';
    $optimized_path = "$target_dir/{$filename}.$ext";

    if ($force || !file_exists($optimized_path) || filemtime($file_path) > filemtime($optimized_path)) {
        if ($mime === 'image/jpeg') {
            imagejpeg($image, $optimized_path, 85); // Optimized JPEG
        } else {
            imagepng($image, $optimized_path, 9); // Max compression for PNG
        }
        echo "  Generated Optimized: $optimized_path\n";
    }

    // 2. Generate WebP Original Size
    $webp_path = "$target_dir/{$filename}.webp";
    if ($force || !file_exists($webp_path) || filemtime($file_path) > filemtime($webp_path)) {
        imagewebp($image, $webp_path, 75);
        echo "  Generated WebP: $webp_path\n";
    }

    // 3. Generate AVIF Original Size (if supported)
    if (function_exists('imageavif')) {
        $avif_path = "$target_dir/{$filename}.avif";
        if ($force || !file_exists($avif_path) || filemtime($file_path) > filemtime($avif_path)) {
            imageavif($image, $avif_path, 75);
            echo "  Generated AVIF: $avif_path\n";
        }
    }

    // 4. Generate LQIP
    $lqip_width = 20;
    $lqip_height = (int)($height * ($lqip_width / $width));
    $lqip_image = imagecreatetruecolor($lqip_width, $lqip_height);

    if ($mime === 'image/png') {
        imagealphablending($lqip_image, false);
        imagesavealpha($lqip_image, true);
        $transparent = imagecolorallocatealpha($lqip_image, 255, 255, 255, 127);
        imagefill($lqip_image, 0, 0, $transparent);
    } else {
        $white = imagecolorallocate($lqip_image, 255, 255, 255);
        imagefill($lqip_image, 0, 0, $white);
    }

    imagecopyresampled($lqip_image, $image, 0, 0, 0, 0, $lqip_width, $lqip_height, $width, $height);
    $lqip_path = "$target_dir/{$filename}-lqip.jpg";

    if ($force || !file_exists($lqip_path) || filemtime($file_path) > filemtime($lqip_path)) {
        imagejpeg($lqip_image, $lqip_path, 20);
        echo "  Generated LQIP: $lqip_path\n";
    }
    imagedestroy($lqip_image);

    // 5. Generate Resized Variants
    foreach ($target_widths as $target_width) {
        // Allow generating variants equal to original width if explicitly requested,
        // but skip if larger (upscaling).
        if ($target_width > $width) {
            continue;
        }

        $new_height = (int)($height * ($target_width / $width));
        $new_image = imagecreatetruecolor($target_width, $new_height);

        if ($mime === 'image/png') {
            imagealphablending($new_image, false);
            imagesavealpha($new_image, true);
             $transparent = imagecolorallocatealpha($new_image, 255, 255, 255, 127);
            imagefill($new_image, 0, 0, $transparent);
        }

        imagecopyresampled($new_image, $image, 0, 0, 0, 0, $target_width, $new_height, $width, $height);

        // Generate Resized JPEG/PNG
        $resized_path = "$target_dir/{$filename}-{$target_width}.$ext";
        if ($force || !file_exists($resized_path) || filemtime($file_path) > filemtime($resized_path)) {
            if ($mime === 'image/jpeg') {
                imagejpeg($new_image, $resized_path, 85);
            } else {
                imagepng($new_image, $resized_path, 9);
            }
            echo "  Generated Resized ($target_width): $resized_path\n";
        }

        // Generate Resized WebP
        $resized_webp_path = "$target_dir/{$filename}-{$target_width}.webp";
        if ($force || !file_exists($resized_webp_path) || filemtime($file_path) > filemtime($resized_webp_path)) {
            imagewebp($new_image, $resized_webp_path, 75);
             echo "  Generated Resized WebP ($target_width): $resized_webp_path\n";
        }

        // Generate Resized AVIF
        if (function_exists('imageavif')) {
            $resized_avif_path = "$target_dir/{$filename}-{$target_width}.avif";
            if ($force || !file_exists($resized_avif_path) || filemtime($file_path) > filemtime($resized_avif_path)) {
                imageavif($new_image, $resized_avif_path, 75);
                 echo "  Generated Resized AVIF ($target_width): $resized_avif_path\n";
            }
        }

        imagedestroy($new_image);
    }

    imagedestroy($image);
}

// Helper for recursive scanning
function scan_dir_recursive($dir) {
    $files = [];
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $files[] = $file->getPathname();
        }
    }
    return $files;
}

echo "Starting image optimization...\n";
if ($force) {
    echo "Force mode enabled.\n";
}

if (!is_dir($source_dir)) {
    die("Source directory not found: $source_dir\n");
}

$files = scan_dir_recursive($source_dir);

foreach ($files as $path) {
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (in_array($ext, ['jpg', 'jpeg', 'png'])) {
        $filename = pathinfo($path, PATHINFO_FILENAME);
        // Skip generated artifacts if any accidentally in src (though we filtered them out)
        if (preg_match('/-(\d+|lqip)$/', $filename)) {
            continue;
        }

        $widths = get_target_widths($filename, $config);
        optimize_image($path, $target_dir, $widths, $force);
    }
}

echo "Optimization complete.\n";
