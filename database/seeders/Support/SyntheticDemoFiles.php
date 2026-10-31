<?php

namespace Database\Seeders\Support;

use Illuminate\Http\UploadedFile;
use RuntimeException;

final class SyntheticDemoFiles
{
    public static function pdf(): string
    {
        $text = 'BT /F1 12 Tf 20 100 Td (Synthetic Checkupino demo. No patient information.) Tj ET';
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 180] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
            '<< /Length '.strlen($text).' >>'."\nstream\n".$text."\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
        $bytes = "%PDF-1.4\n% Synthetic demo\n";
        $offsets = [0];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($bytes);
            $bytes .= ($index + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xref = strlen($bytes);
        $bytes .= "xref\n0 6\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $bytes .= sprintf("%010d 00000 n \n", $offset);
        }

        return $bytes."trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF\n";
    }

    public static function png(int $variant = 0): string
    {
        $colours = [[0, 153, 136], [74, 86, 180], [220, 120, 40]];
        $rgb = $colours[$variant % count($colours)];
        $raw = '';
        for ($y = 0; $y < 360; $y++) {
            $raw .= "\0";
            for ($x = 0; $x < 640; $x++) {
                $accent = ($x > 40 && $x < 600 && $y > 44 && $y < 80)
                    || ($x > 40 && $x < 400 && $y > 110 && $y < 128)
                    || ($x > 40 && $x < 520 && $y > 155 && $y < 270);
                $raw .= $accent ? "\xf4\xf7\xfb" : chr($rgb[0]).chr($rgb[1]).chr($rgb[2]);
            }
        }
        $chunk = static fn (string $type, string $data): string => pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));

        return "\x89PNG\r\n\x1a\n".$chunk('IHDR', pack('NNCCCCC', 640, 360, 8, 2, 0, 0, 0))
            .$chunk('IDAT', gzcompress($raw, 6)).$chunk('IEND', '');
    }

    public static function withUpload(string $bytes, string $name, string $mime, callable $use): mixed
    {
        $root = sys_get_temp_dir().'/checkupino-demo-seed-'.bin2hex(random_bytes(12));
        if (! mkdir($root, 0700)) {
            throw new RuntimeException('Cannot stage synthetic fixture.');
        }
        $path = $root.'/fixture';
        try {
            if (file_put_contents($path, $bytes) !== strlen($bytes) || ! chmod($path, 0600)) {
                throw new RuntimeException('Cannot stage synthetic bytes.');
            }

            return $use(new UploadedFile($path, $name, $mime, UPLOAD_ERR_OK, test: true));
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
            rmdir($root);
        }
    }
}
