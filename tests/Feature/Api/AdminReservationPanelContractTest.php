<?php

namespace Tests\Feature\Api;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class AdminReservationPanelContractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_ADMIN_PANEL_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated admin panel contract only.');
        }
        parent::setUp();
    }

    public function createApplication()
    {
        $environment = '/tmp/checkupino-admin-panel-tests';
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
            || getenv('DB_DATABASE') !== ':memory:' || getenv('DB_URL') || posix_geteuid() !== 33
            || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || getenv('LARAVEL_STORAGE_PATH') !== $environment
            || ! is_dir($environment) || file_exists($environment.'/config.php')
            || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')) {
            throw new RuntimeException('Admin panel tests require isolated SQLite without project environment/cache.');
        }
        $app = require dirname(__DIR__, 3).'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));
        $app->useEnvironmentPath($environment);
        $app->make(Kernel::class)->bootstrap();
        if (config('database.default') !== 'sqlite' || config('database.connections.sqlite.database') !== ':memory:'
            || config('database.connections.sqlite.url')) {
            throw new RuntimeException('Effective SQLite guard failed before schema setup.');
        }

        return $app;
    }

    public function test_only_admin_roles_can_read_reservations_and_no_read_changes_history(): void
    {
        $reservation = Reservation::factory()->create();
        $payment = Payment::factory()->create(['reservation_id' => $reservation->id]);
        $before = $this->fingerprints();
        $this->getJson('/api/admin/reservations')->assertUnauthorized();
        foreach ([User::factory()->patient()->create(), User::factory()->doctor()->create()] as $actor) {
            $this->actingAs($actor, 'sanctum')->getJson('/api/admin/reservations')->assertForbidden();
            $this->getJson('/api/admin/reservations/'.$reservation->id)->assertForbidden();
        }
        foreach ([User::factory()->admin()->create(), User::factory()->rootAdmin()->create()] as $actor) {
            $this->actingAs($actor, 'sanctum')->getJson('/api/admin/reservations')
                ->assertOk()->assertJsonPath('data.0.public_id', $reservation->public_id);
            $this->getJson('/api/admin/reservations/'.$reservation->id)
                ->assertOk()->assertJsonPath('data.payment.public_id', $payment->public_id)
                ->assertJsonMissingPath('data.files')->assertJsonMissingPath('data.reports')
                ->assertJsonMissingPath('data.notes')->assertJsonMissingPath('data.patient.NID')
                ->assertJsonMissingPath('data.patient.password')
                ->assertJsonMissingPath('data.payment.successful_attempt_id');
        }
        $this->assertSame($before, $this->fingerprints());
    }

    public function test_doctor_patient_status_payment_workplace_and_checkup_filters_compose(): void
    {
        $admin = User::factory()->admin()->create();
        $target = Reservation::factory()->create(['status' => ReservationStatus::Confirmed]);
        Payment::factory()->create(['reservation_id' => $target->id, 'status' => 'paid']);
        Reservation::factory()->create();
        $filters = http_build_query([
            'doctor_id' => $target->doctor_profile_id, 'user_id' => $target->user_id,
            'checkup_id' => $target->checkup_id, 'workplace_id' => $target->doctor_workplace_id,
            'status' => 'confirmed', 'payment_status' => 'paid',
        ]);
        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reservations?'.$filters)
            ->assertOk()->assertJsonPath('meta.pagination.total', 1);
        $this->assertSame([$target->id], array_column($response->json('data'), 'id'));
        $this->getJson('/api/admin/reservations?'.$filters.'&q=not-a-matching-record')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_search_supports_reservation_references_and_display_names_but_not_private_email(): void
    {
        $admin = User::factory()->admin()->create();
        $target = Reservation::factory()->create();
        $target->user->update(['name' => 'Synthetic Needle Patient', 'email' => 'needle-patient@example.test']);
        Reservation::factory()->create();
        $this->actingAs($admin, 'sanctum');
        foreach ([$target->public_id, (string) $target->id, 'Needle'] as $query) {
            $response = $this->getJson('/api/admin/reservations?q='.urlencode($query))
                ->assertOk()->assertJsonPath('meta.pagination.total', 1);
            $this->assertSame([$target->id], array_column($response->json('data'), 'id'));
        }
        $this->getJson('/api/admin/reservations?q=needle-patient%40example.test')->assertOk()->assertJsonPath('meta.pagination.total', 0);
    }

    public function test_calendar_filters_include_the_entire_tehran_day_with_exclusive_next_day(): void
    {
        $admin = User::factory()->admin()->create();
        $expected = [];
        foreach (['2026-10-10T20:29:59Z', '2026-10-10T20:30:00Z', '2026-10-11T20:29:59Z', '2026-10-11T20:30:00Z'] as $index => $time) {
            $start = CarbonImmutable::parse($time);
            $reservation = Reservation::factory()->create(['starts_at' => $start, 'ends_at' => $start->addMinutes(30)]);
            if (in_array($index, [1, 2], true)) {
                $expected[] = $reservation->id;
            }
        }
        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/reservations?from=2026-10-11&to=2026-10-11&sort_by=starts_at&sort_dir=asc')
            ->assertOk()->assertJsonPath('meta.pagination.total', 2);
        $this->assertSame($expected, array_column($response->json('data'), 'id'));
    }

    public function test_malformed_filters_are_structured_validation_errors_instead_of_server_errors(): void
    {
        $this->actingAs(User::factory()->admin()->create(), 'sanctum');
        foreach ([
            'status[]=pending' => 'status', 'status=paid' => 'status',
            'payment_status=unknown' => 'payment_status', 'doctor_id=abc' => 'doctor_id',
            'user_id=-1' => 'user_id', 'workplace_id=0' => 'workplace_id',
            'checkup_id[]=1' => 'checkup_id', 'from=bad-date' => 'from',
            'to=2026-02-30' => 'to', 'from=2026-10-12&to=2026-10-11' => 'to',
            'q[]=needle' => 'q', 'q='.str_repeat('a', 201) => 'q',
            'per_page=0' => 'per_page', 'page=100001' => 'page',
            'sort_by=password' => 'sort_by', 'sort_dir[]=asc' => 'sort_dir',
        ] as $query => $field) {
            $this->getJson('/api/admin/reservations?'.$query)->assertUnprocessable()->assertJsonValidationErrors($field);
        }
    }

    public function test_booking_snapshot_and_stable_pagination_survive_catalog_changes_and_ties(): void
    {
        $admin = User::factory()->admin()->create();
        $start = CarbonImmutable::parse('2026-10-18T04:30:00Z');
        $first = Reservation::factory()->create(['starts_at' => $start, 'ends_at' => $start->addMinutes(30), 'price_snapshot' => 7000000]);
        $second = Reservation::factory()->create(['starts_at' => $start, 'ends_at' => $start->addMinutes(30)]);
        $first->checkup->update(['price' => 123456]);
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/reservations?sort_by=starts_at&sort_dir=asc&per_page=1')
            ->assertOk()->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.0.booked_amount', 7000000)->assertJsonPath('data.0.booked_currency', 'IRR')
            ->assertJsonPath('data.0.doctor.user_id', $first->doctor->user_id)
            ->assertJsonPath('data.0.doctor_workplace_id', $first->doctor_workplace_id);
        $this->getJson('/api/admin/reservations?sort_by=starts_at&sort_dir=asc&per_page=1&page=2')
            ->assertOk()->assertJsonPath('data.0.id', $second->id);
        $this->getJson('/api/admin/reservations?per_page=999')->assertOk()->assertJsonPath('meta.pagination.per_page', 100);
    }

    private function fingerprints(): array
    {
        $hashes = [];
        foreach (['reservations', 'reservation_payment_summaries', 'payment_attempts', 'reservation_medical_requests',
            'reservation_files', 'reservation_reports', 'audit_events', 'outbox_events', 'jobs', 'setting_values'] as $table) {
            $hashes[$table] = hash('sha256', json_encode(DB::table($table)->orderBy('id')->get(), JSON_THROW_ON_ERROR));
        }

        return $hashes;
    }

    public function test_quick_period_filters_use_current_server_time_and_active_appointment_states(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-11T10:00:00Z'));
        $this->actingAs(User::factory()->admin()->create(), 'sanctum');
        $past = Reservation::factory()->create(['starts_at' => now()->subHour(), 'ends_at' => now()->subMinutes(30)]);
        $future = Reservation::factory()->create(['starts_at' => now()->addHour(), 'ends_at' => now()->addMinutes(90)]);
        $cancelled = Reservation::factory()->create(['starts_at' => now()->addHours(2), 'ends_at' => now()->addMinutes(150), 'status' => ReservationStatus::Cancelled]);
        $tomorrow = Reservation::factory()->create(['starts_at' => now()->addDay(), 'ends_at' => now()->addDay()->addMinutes(30)]);
        $today = $this->getJson('/api/admin/reservations?period=today')->assertOk()
            ->assertJsonPath('meta.generated_at', '2026-10-11T10:00:00+00:00');
        $this->assertEqualsCanonicalizing([$past->id, $future->id, $cancelled->id], array_column($today->json('data'), 'id'));
        $upcoming = $this->getJson('/api/admin/reservations?period=upcoming')->assertOk();
        $this->assertEqualsCanonicalizing([$future->id, $tomorrow->id], array_column($upcoming->json('data'), 'id'));
        $this->getJson('/api/admin/reservations?period=unknown')->assertUnprocessable()->assertJsonValidationErrors('period');
    }
}
