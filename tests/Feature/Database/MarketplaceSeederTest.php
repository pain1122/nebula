<?php

namespace Tests\Feature\Database;

use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
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
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use LogicException;
use Tests\Support\IsolatedArticleApplication;
use Tests\TestCase;

class MarketplaceSeederTest extends TestCase
{
    use IsolatedArticleApplication;
    use RefreshDatabase;

    public function test_marketplace_seed_graph_is_complete_and_idempotent(): void
    {
        config(['demo.seed_enabled' => true, 'demo.verified_media_seed_enabled' => false]);

        $this->seed(DatabaseSeeder::class);
        $counts = $this->fixtureCounts();
        $this->seed(DatabaseSeeder::class);

        $this->assertSame($counts, $this->fixtureCounts());
        $this->assertSame(3, MarketplaceHospital::count());
        $this->assertSame(2, DoctorProfile::count());
        $this->assertSame(3, DoctorWorkplace::count());
        $this->assertSame(8, DoctorWorkingWindow::count());
        $this->assertSame(9, Reservation::count());
        $this->assertSame(9, Payment::count());
        $this->assertSame(6, PaymentAttempt::count());
        $this->assertSame(9, QuestionnaireChoice::count());
        foreach (['doctor_working_window_breaks' => 8, 'patient_health_snapshots' => 4,
            'patient_biometric_observations' => 6, 'questionnaire_submissions' => 4, 'articles' => 6,
            'article_versions' => 7, 'article_terms' => 5, 'reservation_medical_requests' => 4,
            'article_media_assets' => 0, 'reservation_files' => 0, 'reservation_reports' => 0, 'jobs' => 0] as $table => $count) {
            $this->assertSame($count, DB::table($table)->count(), $table);
        }

        $multiHospitalDoctor = DoctorProfile::whereHas('user', fn ($query) => $query->where('email', 'doctor@checkupino.test'))->firstOrFail();
        $this->assertCount(2, $multiHospitalDoctor->workplaces);
        $this->assertTrue($multiHospitalDoctor->workplaces->every(fn (DoctorWorkplace $workplace): bool => $workplace->checkups()->exists()));
        $this->assertDatabaseHas('payment_attempts', ['status' => 'failed', 'failure_code' => 'sandbox_declined']);
        $this->assertDatabaseHas('reservations', ['status' => 'cancelled']);
        $this->assertDatabaseHas('setting_definitions', ['key' => 'booking.pending_hold_minutes']);
        foreach (['draft', 'in_review', 'reviewed'] as $state) {
            $this->assertDatabaseHas('articles', ['working_state' => $state]);
        }
        $this->assertSame(1, DB::table('articles')->whereNotNull('archived_at')->count());
        $this->assertSame(3, DB::table('articles')->whereNotNull('published_version')->count());
    }

    public function test_dated_appointments_use_real_rules_breaks_and_doctor_owned_prices(): void
    {
        config(['demo.seed_enabled' => true, 'demo.verified_media_seed_enabled' => false]);
        $this->seed(DatabaseSeeder::class);
        foreach (Reservation::with('visitSlot.workingWindow.breaks')->get() as $reservation) {
            $slot = $reservation->visitSlot;
            $rule = $slot->workingWindow;
            $start = $slot->starts_at->copy()->timezone('Asia/Tehran');
            $end = $slot->ends_at->copy()->timezone('Asia/Tehran');
            $this->assertSame($rule->weekday, $start->dayOfWeek);
            $this->assertSame($reservation->price_snapshot, $slot->price);
            $this->assertSame($reservation->currency_snapshot, $slot->currency);
            $this->assertSame($rule->visit_duration_minutes, (int) $start->diffInMinutes($end));
            foreach ($rule->breaks as $break) {
                $this->assertFalse($start->format('H:i:s') < $break->ends_at && $end->format('H:i:s') > $break->starts_at);
            }
        }
        foreach (['demo-ready-to-complete', 'demo-doctor2-ready-to-complete'] as $key) {
            $reservation = Reservation::where('booking_idempotency_key', $key)->firstOrFail();
            $this->assertTrue($reservation->ends_at->isPast());
            $this->assertSame('confirmed', $reservation->status->value);
            $this->assertSame('paid', $reservation->payment->status->value);
        }
    }

    public function test_repeat_keeps_edited_credentials_account_catalog_and_slot_values(): void
    {
        config(['demo.seed_enabled' => true, 'demo.verified_media_seed_enabled' => false]);
        $this->seed(DatabaseSeeder::class);
        $user = User::where('email', 'patient@checkupino.test')->firstOrFail();
        $password = Hash::make('ChangedSyntheticPassword!');
        $user->forceFill(['name' => 'Edited synthetic patient', 'password' => $password, 'account_state' => 'closed'])->save();
        $hospital = MarketplaceHospital::firstOrFail();
        $hospital->update(['name' => 'Edited synthetic clinic']);
        $slot = DoctorVisitSlot::whereDoesntHave('reservations')->firstOrFail();
        $slot->update(['price' => 1234567]);
        $setting = \App\Models\SettingValue::whereHas('definition', fn ($query) => $query->where('key', 'booking.pending_hold_minutes'))->firstOrFail();
        $setting->update(['value' => 27]);
        $before = $this->fixtureCounts();
        $this->seed(DatabaseSeeder::class);
        $this->assertSame($before, $this->fixtureCounts());
        $this->assertSame($password, $user->fresh()->getAuthPassword());
        $this->assertSame('closed', $user->fresh()->account_state->value);
        $this->assertSame('Edited synthetic patient', $user->fresh()->name);
        $this->assertSame('Edited synthetic clinic', $hospital->fresh()->name);
        $this->assertSame(1234567, $slot->fresh()->price);
        $this->assertSame(27, $setting->fresh()->value);
    }

    public function test_demo_seed_refuses_accounts_outside_its_fixture_set_before_foundation_writes(): void
    {
        config(['demo.seed_enabled' => true, 'demo.verified_media_seed_enabled' => false]);
        User::factory()->create(['email' => 'unrelated@example.test']);
        try {
            $this->seed(DatabaseSeeder::class);
            $this->fail('Mixed database was admitted.');
        } catch (LogicException $error) {
            $this->assertStringContainsString('outside its own fixture set', $error->getMessage());
        }
        $this->assertSame(1, User::count());
        $this->assertSame(0, SettingDefinition::count());
        $this->assertSame(0, Reservation::count());
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
            'history' => DB::table('patient_health_snapshots')->count(),
            'submissions' => DB::table('questionnaire_submissions')->count(),
            'versions' => DB::table('article_versions')->count(),
            'audits' => DB::table('audit_events')->count(),
        ];
    }
}
