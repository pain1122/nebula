<?php

namespace Tests\Feature\Database;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationBookingPaymentMigrationLifecycleTest extends TestCase
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
        'database/migrations/2025_11_09_123759_create_payments_table.php',
    ];

    public function test_booking_and_payment_group_rolls_back_and_reapplies(): void
    {
        Artisan::call('migrate:fresh', ['--path' => $this->paths, '--force' => true]);

        $this->assertTrue(Schema::hasTable('reservations'));
        $this->assertTrue(Schema::hasTable('reservation_payment_summaries'));
        $this->assertTrue(Schema::hasTable('payment_attempts'));

        Artisan::call('migrate:rollback', ['--path' => $this->paths, '--force' => true]);

        $this->assertFalse(Schema::hasTable('reservations'));
        $this->assertFalse(Schema::hasTable('reservation_payment_summaries'));
        $this->assertFalse(Schema::hasTable('payment_attempts'));

        Artisan::call('migrate', ['--path' => $this->paths, '--force' => true]);

        $this->assertTrue(Schema::hasTable('reservations'));
        $this->assertTrue(Schema::hasTable('reservation_payment_summaries'));
        $this->assertTrue(Schema::hasTable('payment_attempts'));
    }
}
