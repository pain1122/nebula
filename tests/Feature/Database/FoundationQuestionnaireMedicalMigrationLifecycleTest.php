<?php

namespace Tests\Feature\Database;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationQuestionnaireMedicalMigrationLifecycleTest extends TestCase
{
    /**
     * @var list<string>
     */
    private array $paths = [
        'database/migrations/0001_01_01_000000_create_users_table.php',
        'database/migrations/2025_11_09_070000_create_marketplace_hospital_directory_tables.php',
        'database/migrations/2025_11_09_072222_create_specialties_table.php',
        'database/migrations/2025_11_09_072921_create_doctor_profiles_table.php',
        'database/migrations/2025_11_09_105430_create_checkup_categories_table.php',
        'database/migrations/2025_11_09_105440_create_checkups_table.php',
        'database/migrations/2025_11_09_110000_create_doctor_workplace_services_and_windows.php',
        'database/migrations/2025_11_09_123756_create_reservations_table.php',
        'database/migrations/2025_11_09_123757_create_reservation_notes_table.php',
        'database/migrations/2025_11_09_123758_create_reservation_files_table.php',
        'database/migrations/2025_12_01_083045_create_questionnaires_table.php',
        'database/migrations/2025_12_01_083055_create_questionnaire_questions_table.php',
        'database/migrations/2025_12_01_083075_create_questionnaire_choices_table.php',
        'database/migrations/2025_12_01_083085_create_questionnaire_recommendations_table.php',
        'database/migrations/2025_12_01_083086_questionnaire_submissions.php',
        'database/migrations/2026_06_03_095153_create_user_profiles_table.php',
        'database/migrations/2026_06_03_103137_create_leads_table.php',
    ];

    public function test_questionnaire_and_medical_group_rolls_back_and_reapplies(): void
    {
        Artisan::call('migrate:fresh', ['--path' => $this->paths, '--force' => true]);

        $this->assertTrue(Schema::hasTable('questionnaire_submissions'));
        $this->assertTrue(Schema::hasTable('leads'));
        $this->assertTrue(Schema::hasTable('reservation_files'));

        Artisan::call('migrate:rollback', ['--path' => $this->paths, '--force' => true]);

        $this->assertFalse(Schema::hasTable('questionnaire_submissions'));
        $this->assertFalse(Schema::hasTable('leads'));
        $this->assertFalse(Schema::hasTable('reservation_files'));

        Artisan::call('migrate', ['--path' => $this->paths, '--force' => true]);

        $this->assertTrue(Schema::hasTable('questionnaire_submissions'));
        $this->assertTrue(Schema::hasTable('leads'));
        $this->assertTrue(Schema::hasTable('reservation_files'));
    }
}
