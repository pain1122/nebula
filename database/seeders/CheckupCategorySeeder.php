<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\CheckupCategory;

class CheckupCategorySeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['name' => 'عمومی',    'slug' => 'general', 'description' => 'چکاپ‌های عمومی و پایه'],
            ['name' => 'قلب و عروق','slug' => 'cardio',  'description' => 'غربالگری و ارزیابی قلبی‌عروقی'],
            ['name' => 'گوارش',    'slug' => 'gi',      'description' => 'آزمایش‌ها و ارزیابی‌های گوارشی'],
        ];

        foreach ($items as $i) {
            CheckupCategory::updateOrCreate(['slug' => $i['slug']], $i);
        }
    }
}
