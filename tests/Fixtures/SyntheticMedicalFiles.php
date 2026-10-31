<?php

namespace Tests\Fixtures;

final class SyntheticMedicalFiles
{
    public static function pdf(string $catalogExtra = '', int $pages = 1, int $paddingBytes = 0): string
    {
        $kids = implode(' ', array_map(fn (int $number): string => ($number + 3).' 0 R', range(0, $pages - 1)));
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R '.$catalogExtra.' >>',
            '<< /Type /Pages /Kids ['.$kids.'] /Count '.$pages.' >>',
        ];
        for ($page = 0; $page < $pages; $page++) {
            $objects[] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources << >> >>';
        }
        if ($paddingBytes > 0) {
            $objects[] = '<< /Length '.$paddingBytes." >>\nstream\n".str_repeat('x', $paddingBytes)."\nendstream";
        }
        $pdf = "%PDF-1.4\n% Synthetic content only\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xref = strlen($pdf);
        $size = count($objects) + 1;
        $pdf .= "xref\n0 ".$size."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf('%010d 00000 n ', $offset)."\n";
        }

        return $pdf."trailer\n<< /Size ".$size." /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF\n";
    }
}
