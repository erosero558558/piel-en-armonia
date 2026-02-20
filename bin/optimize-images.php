<?php

// Image Optimization Script
// Generates responsive WebP images from source JPG/PNGs.

$source_dirs = ['.', 'images/optimized'];
$target_dir = 'images/optimized';
$resolutions = [
    'mobile' => 640,
    'tablet' => 1024,
    'desktop' => 'original' // Keep original resolution
];

if (!is_dir($target_dir)) {
    mkdir($target_dir, 0755, true);
}

function optimize_image($file_path, $target_dir, $resolutions) {
    $info = getimagesize($file_path);
    if (!$info) {
        echo "Skipping invalid image: $file_path\n";
        return;
    }

    $mime = $info['mime'];
    $width = $info[0];
    $height = $info[1];
    $filename = pathinfo($file_path, PATHINFO_FILENAME);

    // Create source image resource
    switch ($mime) {
        case 'image/jpeg':
            $image = imagecreatefromjpeg($file_path);
            break;
        case 'image/png':
            $image = imagecreatefrompng($file_path);
            break;
        default:
            // Skip non-supported types
            return;
    }

    if (!$image) {
        echo "Failed to load image: $file_path\n";
        return;
    }

    foreach ($resolutions as $name => $target_width) {
        $new_width = ($target_width === 'original') ? $width : $target_width;

        // Don't upscale small images (unless original)
        if ($target_width !== 'original' && $width < $target_width) {
            continue;
        }

        // Calculate height proportionally
        $new_height = ($target_width === 'original') ? $height : (int)($height * ($new_width / $width));

        // Create new image resource
        $new_image = imagecreatetruecolor($new_width, $new_height);

        // Preserve transparency for PNG
        if ($mime === 'image/png') {
            imagealphablending($new_image, false);
            imagesavealpha($new_image, true);
        }

        // Resize
        imagecopyresampled($new_image, $image, 0, 0, 0, 0, $new_width, $new_height, $width, $height);

        // Generate filename: name-width.webp (e.g., hero-woman-640.webp)
        // If original, use name-original.webp to distinguish? Or just name.webp?
        // Let's use name-width.webp to be explicit about size.
        // Special case: If original, maybe keep name.webp for backward compatibility?
        // Actually, the plan says name-width.webp. But existing code uses name.webp.
        // Let's output BOTH name.webp (for existing code) AND name-width.webp (for srcset).

        $output_filename = "{$filename}-{$new_width}.webp";
        $output_path = "{$target_dir}/{$output_filename}";

        // Save as WebP
        imagewebp($new_image, $output_path, 82);
        echo "Generated: {$output_path} ({$new_width}x{$new_height})\n";

        // If this is the original size, also update/create the standard name.webp
        if ($target_width === 'original') {
             $standard_path = "{$target_dir}/{$filename}.webp";
             imagewebp($new_image, $standard_path, 82);
             echo "Updated standard: {$standard_path}\n";
        }

        imagedestroy($new_image);
    }

    imagedestroy($image);
}

// Main execution
foreach ($source_dirs as $dir) {
    if (!is_dir($dir)) continue;

    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;

        $path = $dir . '/' . $file;
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        // Only process source JPG/PNG files
        // Avoid re-processing generated webp files or thumbnails
        if (in_array($ext, ['jpg', 'png']) && strpos($file, '-640') === false && strpos($file, '-1024') === false) {
             echo "Processing: $path\n";
             optimize_image($path, $target_dir, $resolutions);
        }
    }
}

echo "Optimization complete.\n";
