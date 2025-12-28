<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Checkup;
use App\Models\CheckupCategory;

class CheckupSeeder extends Seeder
{
    public function run(): void
    {
        $general = CheckupCategory::where('slug','general')->first();
        $cardio  = CheckupCategory::where('slug','cardio')->first();
        $gi      = CheckupCategory::where('slug','gi')->first();

        $rows = [
            // عمومی
            ['checkup_category_id'=>$general?->id,'title'=>'چکاپ پایه',           'slug'=>'basic-health-check','price'=>500000,'description'=>'CBC, ESR, FBS, Lipid Profile'],
            ['checkup_category_id'=>$general?->id,'title'=>'چکاپ جامع',           'slug'=>'full-body-check',  'price'=>1500000,'description'=>'پکیج کامل عمومی'],
            // قلب
            ['checkup_category_id'=>$cardio?->id, 'title'=>'ارزیابی قلب',         'slug'=>'cardio-eval',      'price'=>1200000,'description'=>'ECG + Echocardiography'],
            ['checkup_category_id'=>$cardio?->id, 'title'=>'تست ورزش',            'slug'=>'stress-test',      'price'=>900000, 'description'=>'Treadmill Test'],
            // گوارش
            ['checkup_category_id'=>$gi?->id,     'title'=>'بررسی کبد',           'slug'=>'liver-panel',      'price'=>700000, 'description'=>'LFT Panel'],
            ['checkup_category_id'=>$gi?->id,     'title'=>'هلیکوباکتر (HP)',     'slug'=>'h-pylori-test',    'price'=>300000, 'description'=>'H. pylori Ag/Ab'],
        ];

        foreach ($rows as $r) {
            if ($r['checkup_category_id']) {
                Checkup::updateOrCreate(['slug'=>$r['slug']], $r);
            }
        }
    }
}
