<?php

// Standalone child process: no Laravel bootstrap, credentials, output files or URLs.
try {
    if (PHP_SAPI !== 'cli' || $argc !== 6 || ! function_exists('imagecreatefromstring')) {
        exit(2);
    }
    set_error_handler(static function (): never {
        throw new RuntimeException;
    });
    [, $path, $mime, $widthLimit, $heightLimit, $pixelLimit] = $argv;
    $type = match ($mime) {
        'image/jpeg' => IMAGETYPE_JPEG,
        'image/png' => IMAGETYPE_PNG,
        default => throw new RuntimeException,
    };
    $header = getimagesize($path);
    if (! is_array($header) || $header[2] !== $type || $header[0] < 1 || $header[1] < 1
        || $header[0] > (int) $widthLimit || $header[1] > (int) $heightLimit
        || $header[0] > intdiv((int) $pixelLimit, $header[1])) {
        throw new RuntimeException;
    }
    // Dimensions only preflight resource use; full decoding is mandatory.
    $content = file_get_contents($path);
    if (($type === IMAGETYPE_JPEG && ! str_ends_with($content, "\xff\xd9"))
        || ($type === IMAGETYPE_PNG && ! str_ends_with($content, "\x00\x00\x00\x00IEND\xae\x42\x60\x82"))) {
        throw new RuntimeException;
    }
    $image = imagecreatefromstring($content);
    if (! $image instanceof GdImage || imagesx($image) !== $header[0] || imagesy($image) !== $header[1]) {
        throw new RuntimeException;
    }
    imagedestroy($image);
    $version = gd_info()['GD Version'];
    if ($version === 'bundled (2.1.0 compatible)') {
        echo 'gd-bundled/php-'.PHP_VERSION.'/medical-v1';
    } elseif (preg_match('/^[0-9]+\.[0-9]+\.[0-9]+$/D', $version)) {
        echo 'gd-'.$version.'/medical-v1';
    } else {
        throw new RuntimeException;
    }
} catch (Throwable) {
    exit(2);
}
