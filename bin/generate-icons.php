<?php
// bin/generate-icons.php

$icons = [
    'icon-192.png' => 192,
    'icon-512.png' => 512
];

$fontFile = __DIR__ . '/../fonts/PlusJakartaSans-Bold.ttf'; // Use a font if available, or built-in
// Check if we have fonts. If not, use built-in font (1-5).
// Let's use built-in font 5.

foreach ($icons as $filename => $size) {
    $im = imagecreatetruecolor($size, $size);

    // Brand colors
    $blue = imagecolorallocate($im, 13, 26, 47); // Dark blue from theme
    $white = imagecolorallocate($im, 255, 255, 255);
    $accent = imagecolorallocate($im, 37, 177, 106); // Green/Accent

    // Fill background
    imagefilledrectangle($im, 0, 0, $size, $size, $blue);

    // Draw a simple logo (P A)
    // Since we might not have TTF, let's draw some geometric shapes or text with built-in font

    // Draw a circle
    imagefilledellipse($im, $size/2, $size/2, $size*0.8, $size*0.8, $white);

    // Draw text "PA" (Piel Armonia)
    // Built-in fonts are small. Let's draw lines to make a "P" and "A"?
    // Or just "P"

    // Better: Scale the text if possible. GD built-in fonts are fixed size.
    // So we'll just draw a stylized symbol.

    // Draw a cross/plus for medical
    $thickness = $size * 0.15;
    $len = $size * 0.5;

    // Vertical rect
    imagefilledrectangle($im, ($size - $thickness)/2, ($size - $len)/2, ($size + $thickness)/2, ($size + $len)/2, $blue);
    // Horizontal rect
    imagefilledrectangle($im, ($size - $len)/2, ($size - $thickness)/2, ($size + $len)/2, ($size + $thickness)/2, $blue);

    // Save
    $path = __DIR__ . '/../images/' . $filename;
    imagepng($im, $path);
    imagedestroy($im);
    echo "Generated $path\n";
}
