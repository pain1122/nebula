<?php

namespace Tests\Feature\Database;

use App\Models\DoctorProfile;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Questionnaire;
use App\Models\QuestionnaireChoice;
use App\Models\Reservation;
use App\Models\SettingDefinition;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketplaceSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketplace_seed_graph_is_complete_and_idempotent(): void
    {
        config(['demo.seed_enabled' => true]);

        $this->seed(DatabaseSeeder::class);
        $counts = $this->fixtureCounts();
        $this->seed(DatabaseSeeder::class);

        $this->assertSame($counts, $this->fixtureCounts());
        $this->assertSame(3, MarketplaceHospital::count());
        $this->assertSame(2, DoctorProfile::count());
        $this->assertSame(3, DoctorWorkplace::count());
        $this->assertSame(5, DoctorWorkingWindow::count());
        $this->assertSame(6, Reservation::count());
        $this->assertSame(6, Payment::count());
        $this->assertSame(3, PaymentAttempt::count());
        $this->assertSame(9, QuestionnaireChoice::count());

        $multiHospitalDoctor = DoctorProfile::whereHas('user', fn ($query) => $query->where('email', 'doctor@checkupino.test'))->firstOrFail();
        $this->assertCount(2, $multiHospitalDoctor->workplaces);
        $this->assertTrue($multiHospitalDoctor->workplaces->every(fn (DoctorWorkplace $workplace): bool => $workplace->checkups()->exists()));
        $this->assertDatabaseHas('payment_attempts', ['status' => 'failed', 'failure_code' => 'sandbox_declined']);
        $this->assertDatabaseHas('reservations', ['status' => 'cancelled']);
        $this->assertDatabaseHas('setting_definitions', ['key' => 'booking.pending_hold_minutes']);
    }

    /** @return array<string, int> */
    private function fixtureCounts(): array
    {
        return [
            'users' => User::count(),
            'hospitals' => MarketplaceHospital::count(),
            'workplaces' => DoctorWorkplace::count(),
            'windows' => DoctorWorkingWindow::count(),
            'reservations' => Reservation::count(),
            'payments' => Payment::count(),
            'attempts' => PaymentAttempt::count(),
            'questionnaires' => Questionnaire::count(),
            'settings' => SettingDefinition::count(),
        ];
    }
}
