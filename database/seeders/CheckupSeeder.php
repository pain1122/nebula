<?php

namespace Database\Seeders;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use Illuminate\Database\Seeder;

class CheckupSeeder extends Seeder
{
    public function run(): void
    {
        $categoryIds = CheckupCategory::query()->whereIn('slug', ['general', 'cardio', 'gi'])->pluck('id', 'slug');

        $checkups = [
            ['category' => 'general', 'title' => 'Basic Health Check', 'slug' => 'basic-health-check', 'price' => 5_000_000, 'description' => 'CBC, blood sugar, and lipid profile.', 'default_duration_minutes' => 30],
            ['category' => 'general', 'title' => 'Comprehensive Health Check', 'slug' => 'full-body-check', 'price' => 15_000_000, 'description' => 'A comprehensive preventive assessment.', 'default_duration_minutes' => 60],
            ['category' => 'cardio', 'title' => 'Cardiac Evaluation', 'slug' => 'cardio-eval', 'price' => 12_000_000, 'description' => 'ECG and cardiac consultation.', 'default_duration_minutes' => 45],
            ['category' => 'cardio', 'title' => 'Exercise Stress Test', 'slug' => 'stress-test', 'price' => 9_000_000, 'description' => 'Supervised treadmill stress test.', 'default_duration_minutes' => 45],
            ['category' => 'gi', 'title' => 'Liver Function Panel', 'slug' => 'liver-panel', 'price' => 7_000_000, 'description' => 'Liver function assessment and consultation.', 'default_duration_minutes' => 30],
            ['category' => 'gi', 'title' => 'H. Pylori Assessment', 'slug' => 'h-pylori-test', 'price' => 3_000_000, 'description' => 'H. pylori screening consultation.', 'default_duration_minutes' => 20],
        ];

        foreach ($checkups as $checkup) {
            $category = $checkup['category'];
            unset($checkup['category']);

            Checkup::updateOrCreate(
                ['slug' => $checkup['slug']],
                $checkup + ['checkup_category_id' => $categoryIds->get($category), 'currency' => 'IRR']
            );
        }
    }
}
