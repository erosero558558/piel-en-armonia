<?php

// bin/optimize-images.php
// Script to generate responsive WebP images and LQIP placeholders.

$source_dirs = ['.', 'images/optimized'];
$target_dir = 'images/optimized';

// Configuration: Map prefixes to target widths
$config = [
    'hero-woman' => [640, 1024, 1344],
    'showcase-hero' => [640, 1024, 1400],
    'showcase-diagnostic' => [640, 800],
    'showcase-clinic' => [640, 800],
    'showcase-treatment' => [640, 900],
    'service-' => [400],
    'team-' => [500],
];

if (!extension_loaded('gd')) {
    die("Error: GD extension is required.\n");
}

if (!is_dir($target_dir)) {
    mkdir($target_dir, 0755, true);
}

function get_target_widths($filename, $config)
{
    foreach ($config as $prefix => $widths) {
        // Check if filename starts with prefix (handling wildcards like service-)
        $clean_prefix = rtrim($prefix, '-');
        if (strpos($filename, $clean_prefix) === 0) {
            return $widths;
        }
    }
    return [];
}

function optimize_image($file_path, $target_dir, $target_widths)
{
    $info = getimagesize($file_path);
    if (!$info) {
        // Not a valid image
        return;
    }

    $mime = $info['mime'];
    $width = $info[0];
    $height = $info[1];
    $filename = pathinfo($file_path, PATHINFO_FILENAME);

    // Skip if filename looks like a generated artifact (ends in digits or lqip)
    if (preg_match('/-(\d+|lqip)$/', $filename)) {
        return;
    }

    echo "Processing: $file_path ($width x $height)\n";

    // Load image
    switch ($mime) {
        case 'image/jpeg':
            $image = imagecreatefromjpeg($file_path);
            break;
        case 'image/png':
            $image = imagecreatefrompng($file_path);
            // Preserve transparency
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

    // Generate LQIP (20px width)
    $lqip_width = 20;
    $lqip_height = (int)($height * ($lqip_width / $width));
    $lqip_image = imagecreatetruecolor($lqip_width, $lqip_height);

    // Fill with white background for LQIP (simpler for blur-up)
    $white = imagecolorallocate($lqip_image, 255, 255, 255);
    imagefill($lqip_image, 0, 0, $white);

    imagecopyresampled($lqip_image, $image, 0, 0, 0, 0, $lqip_width, $lqip_height, $width, $height);
    $lqip_path = "$target_dir/{$filename}-lqip.jpg";

    // Only generate if not exists or source is newer
    if (!file_exists($lqip_path) || filemtime($file_path) > filemtime($lqip_path)) {
        imagejpeg($lqip_image, $lqip_path, 20);
        echo "  Generated LQIP: $lqip_path\n";
    }
    imagedestroy($lqip_image);

    // Generate WebP Original Size
    $webp_original_path = "$target_dir/{$filename}.webp";
    if (!file_exists($webp_original_path) || filemtime($file_path) > filemtime($webp_original_path)) {
        imagewebp($image, $webp_original_path, 80);
        echo "  Generated WebP (Original): $webp_original_path\n";
    }

    // Generate WebP Resized Variants
    foreach ($target_widths as $target_width) {
        if ($target_width >= $width) {
            continue;
        } // Skip upscaling

        $new_height = (int)($height * ($target_width / $width));
        $new_image = imagecreatetruecolor($target_width, $new_height);

        if ($mime === 'image/png') {
            imagealphablending($new_image, false);
            imagesavealpha($new_image, true);
        }

        imagecopyresampled($new_image, $image, 0, 0, 0, 0, $target_width, $new_height, $width, $height);

        $output_path = "$target_dir/{$filename}-{$target_width}.webp";
        if (!file_exists($output_path) || filemtime($file_path) > filemtime($output_path)) {
            imagewebp($new_image, $output_path, 80);
            echo "  Generated WebP ($target_width): $output_path\n";
        }
        imagedestroy($new_image);
    }

    imagedestroy($image);
}

// Main execution
echo "Starting image optimization...\n";

foreach ($source_dirs as $dir) {
    if (!is_dir($dir)) {
        continue;
    }

    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') {
            continue;
        }

        $path = $dir . '/' . $file;
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        if (in_array($ext, ['jpg', 'jpeg', 'png'])) {
            // Check if it's a source file (not generated)
            $filename = pathinfo($path, PATHINFO_FILENAME);
            if (!preg_match('/-(\d+|lqip)$/', $filename)) {
                $widths = get_target_widths($filename, $config);
                optimize_image($path, $target_dir, $widths);
            }
        }
    }
}

echo "Optimization complete.\n";
