<?php

namespace Database\Seeders;

use App\Models\CheckupCategory;
use Illuminate\Database\Seeder;

class CheckupCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'General Health', 'slug' => 'general', 'description' => 'General and preventive health assessments.'],
            ['name' => 'Cardiovascular', 'slug' => 'cardio', 'description' => 'Heart and cardiovascular screening services.'],
            ['name' => 'Digestive Health', 'slug' => 'gi', 'description' => 'Gastrointestinal and liver assessments.'],
        ];

        foreach ($categories as $category) {
            CheckupCategory::updateOrCreate(['slug' => $category['slug']], $category);
        }
    }
}
