<?php

namespace Tests\Feature\Services;

use App\Enums\PaymentAttemptStatus;
use App\Models\ReservationStatus;
use App\Models\User;
use App\Services\ReservationLifecycleService;
use Illuminate\Contracts\Console\Kernel;
use RuntimeException;

class DemoAppointmentCompletionTest extends ReservationLifecycleServiceTest
{
    protected function setUp(): void
    {
        if (getenv('CHECKUPINO_COMPLETION_REHEARSAL') !== 'true') {
            $this->markTestSkipped('Explicit isolated completion acceptance only.');
        }
        parent::setUp();
    }

    public function createApplication()
    {
        $environment = '/tmp/checkupino-upload-tests';
        if (getenv('APP_ENV') !== 'testing' || getenv('DB_CONNECTION') !== 'sqlite'
            || getenv('DB_DATABASE') !== ':memory:' || getenv('DB_URL') || posix_geteuid() !== 33
            || getenv('APP_CONFIG_CACHE') !== $environment.'/config.php'
            || getenv('LARAVEL_STORAGE_PATH') !== $environment
            || ! is_dir($environment) || file_exists($environment.'/config.php')
            || file_exists($environment.'/.env') || file_exists($environment.'/.env.testing')) {
            throw new RuntimeException('Completion tests require isolated SQLite and skip project environment/cache.');
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

    public function test_availability_uses_the_service_clock_and_preserves_state(): void
    {
        [$reservation, $payment, $attempt] = $this->paidReservation(['starts_at' => now()->addHour()]);
        $service = app(ReservationLifecycleService::class);
        $this->assertFalse($service->canComplete($reservation));
        $this->travelTo($reservation->starts_at->copy());
        $this->assertTrue($service->canComplete($reservation->fresh()));
        $this->assertSame(ReservationStatus::Confirmed, $reservation->fresh()->status);
        $this->assertSame($attempt->id, $payment->fresh()->successful_attempt_id);
        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }

    public function test_doctor_availability_matches_canonical_success_and_hides_from_other_roles(): void
    {
        [$reservation, $payment, $attempt] = $this->paidReservation();
        $doctor = $reservation->doctor->user;
        $this->actingAs($doctor, 'sanctum')->getJson('/api/doctor/reservations/'.$reservation->id)
            ->assertOk()->assertJsonPath('data.can_complete', true)
            ->assertJsonMissingPath('data.payment.successful_attempt_id')
            ->assertJsonMissingPath('data.payment.successfulAttempt');
        $attempt->forceFill(['status' => PaymentAttemptStatus::Failed])->save();
        $this->getJson('/api/doctor/reservations/'.$reservation->id)->assertOk()
            ->assertJsonPath('data.can_complete', false);
        $this->actingAs(User::factory()->doctor()->create(), 'sanctum')
            ->getJson('/api/doctor/reservations/'.$reservation->id)->assertNotFound();
        $this->actingAs($reservation->user, 'sanctum')
            ->getJson('/api/doctor/reservations/'.$reservation->id)->assertForbidden();
        $this->assertDatabaseCount('audit_events', 0);
        $this->assertDatabaseCount('outbox_events', 0);
    }
}
