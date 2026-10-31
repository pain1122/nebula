<?php

namespace Tests\Feature\Services;

use App\Enums\UserRole;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkingWindow;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Reservation;
use App\Models\Specialty;
use App\Models\User;
use App\Services\BookingService;
use App\Services\ReservationRescheduleService;
use Carbon\Carbon;
use Database\Seeders\RolesSeeder;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Tests\TestCase;
use Throwable;

class BookingMySqlConcurrencyTest extends TestCase
{
    public function test_concurrent_requests_cannot_commit_the_same_doctor_range_twice(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('This regression requires MySQL row-level locking.');
        }

        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('This regression requires the pcntl extension.');
        }

        Artisan::call('migrate:fresh', ['--force' => true]);
        $this->seed(RolesSeeder::class);
        [$firstPatient, $secondPatient, $doctorUser, $doctor, $workplace, $checkup, $original, $targetSlot, $start] = $this->bookableGraph();
        $directory = storage_path('framework/testing/booking-concurrency-'.Str::uuid());
        File::ensureDirectoryExists($directory);
        $children = [];

        try {
            $children[] = $this->forkBookingWorker(
                $directory,
                'winner',
                $firstPatient,
                $doctor,
                $workplace,
                $checkup,
                $targetSlot,
                $start,
                ownsInitialLock: true,
                operation: 'book',
            );
            $children[] = $this->forkBookingWorker(
                $directory,
                'contender',
                $secondPatient,
                $doctor,
                $workplace,
                $checkup,
                $targetSlot,
                $start,
                ownsInitialLock: false,
                operation: 'book',
            );

            $exitCodes = $this->waitForChildren($children, 15);
            $children = [];
            $winner = $this->readResult($directory.'/winner.json');
            $contender = $this->readResult($directory.'/contender.json');

            $this->assertSame([0, 0], $exitCodes, json_encode([$winner, $contender]));
            $this->assertSame('created', $winner['outcome'] ?? null);
            $this->assertSame('time_conflict', $contender['outcome'] ?? null);
            $this->assertGreaterThanOrEqual(
                200,
                $contender['elapsed_ms'] ?? 0,
                'The contender did not wait on the doctor row lock.',
            );

            DB::purge();
            $this->assertSame(1, Reservation::query()->where('starts_at', $start)->count());
            $this->assertDatabaseCount('reservations', 2);
            $this->assertDatabaseCount('reservation_payment_summaries', 2);
            $this->assertDatabaseCount('outbox_events', 2);
        } finally {
            foreach ($children as $child) {
                if ($child > 0) {
                    posix_kill($child, SIGTERM);
                    pcntl_waitpid($child, $status);
                }
            }

            DB::purge();
            Artisan::call('migrate:fresh', ['--force' => true]);
            File::deleteDirectory($directory);
        }
    }

    public function test_concurrent_creation_blocks_a_reschedule_into_the_same_range(): void
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('This regression requires MySQL row-level locking.');
        }

        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('This regression requires the pcntl extension.');
        }

        Artisan::call('migrate:fresh', ['--force' => true]);
        $this->seed(RolesSeeder::class);
        [$firstPatient, , $doctorUser, $doctor, $workplace, $checkup, $original, $targetSlot, $start] = $this->bookableGraph();
        $directory = storage_path('framework/testing/booking-reschedule-concurrency-'.Str::uuid());
        File::ensureDirectoryExists($directory);
        $children = [];

        try {
            $children[] = $this->forkBookingWorker(
                $directory,
                'winner',
                $firstPatient,
                $doctor,
                $workplace,
                $checkup,
                $targetSlot,
                $start,
                ownsInitialLock: true,
                operation: 'book',
            );
            $children[] = $this->forkBookingWorker(
                $directory,
                'contender',
                $doctorUser,
                $doctor,
                $workplace,
                $checkup,
                $targetSlot,
                $start,
                ownsInitialLock: false,
                operation: 'reschedule',
                reservation: $original,
            );

            $exitCodes = $this->waitForChildren($children, 15);
            $children = [];
            $winner = $this->readResult($directory.'/winner.json');
            $contender = $this->readResult($directory.'/contender.json');

            $this->assertSame([0, 0], $exitCodes, json_encode([$winner, $contender]));
            $this->assertSame('created', $winner['outcome'] ?? null);
            $this->assertSame('time_conflict', $contender['outcome'] ?? null);
            $this->assertGreaterThanOrEqual(200, $contender['elapsed_ms'] ?? 0);

            DB::purge();
            $this->assertTrue($original->fresh()->starts_at->equalTo($start->copy()->setTime(9, 0)));
            $this->assertDatabaseCount('reservation_schedule_changes', 0);
            $this->assertSame(1, Reservation::query()->where('starts_at', $start)->count());
        } finally {
            foreach ($children as $child) {
                if ($child > 0) {
                    posix_kill($child, SIGTERM);
                    pcntl_waitpid($child, $status);
                }
            }

            DB::purge();
            Artisan::call('migrate:fresh', ['--force' => true]);
            File::deleteDirectory($directory);
        }
    }

    private function forkBookingWorker(
        string $directory,
        string $name,
        User $patient,
        DoctorProfile $doctor,
        DoctorWorkplace $workplace,
        Checkup $checkup,
        DoctorVisitSlot $targetSlot,
        Carbon $start,
        bool $ownsInitialLock,
        string $operation,
        ?Reservation $reservation = null,
    ): int {
        $pid = pcntl_fork();

        if ($pid === -1) {
            throw new RuntimeException('Unable to fork the booking worker.');
        }

        if ($pid === 0) {
            $this->runBookingWorker(
                $directory,
                $name,
                $patient,
                $doctor,
                $workplace,
                $checkup,
                $targetSlot,
                $start,
                $ownsInitialLock,
                $operation,
                $reservation,
            );
        }

        return $pid;
    }

    private function runBookingWorker(
        string $directory,
        string $name,
        User $patient,
        DoctorProfile $doctor,
        DoctorWorkplace $workplace,
        Checkup $checkup,
        DoctorVisitSlot $targetSlot,
        Carbon $start,
        bool $ownsInitialLock,
        string $operation,
        ?Reservation $reservation,
    ): never {
        $startedAt = hrtime(true);

        try {
            DB::purge();

            if ($ownsInitialLock) {
                DB::beginTransaction();
                DoctorVisitSlot::query()
                    ->where('public_id', $targetSlot->public_id)
                    ->lockForUpdate()
                    ->firstOrFail();
                File::put($directory.'/lock.ready', 'ready');
                $this->waitForFile($directory.'/contender.ready', 5);
                usleep(500_000);
            } else {
                $this->waitForFile($directory.'/lock.ready', 5);
                File::put($directory.'/contender.ready', 'ready');
            }

            if ($operation === 'reschedule') {
                app(ReservationRescheduleService::class)->reschedule(
                    Request::create('/api/doctor/reservations/1/schedule', 'PUT'),
                    $patient,
                    $reservation ?? throw new RuntimeException('A reservation is required.'),
                    $targetSlot->public_id,
                    'Concurrent replacement range.',
                );
            } else {
                app(BookingService::class)->createReservation(
                    user: $patient,
                    slotPublicId: $targetSlot->public_id,
                );
            }

            if ($ownsInitialLock) {
                DB::commit();
            }

            $result = ['outcome' => 'created'];
        } catch (ValidationException $exception) {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            $result = [
                'outcome' => $exception->errors()['time'][0] ?? 'validation_error',
            ];
        } catch (DomainException) {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            $result = ['outcome' => 'time_conflict'];
        } catch (Throwable $exception) {
            while (DB::transactionLevel() > 0) {
                DB::rollBack();
            }

            $result = [
                'outcome' => 'error',
                'error' => $exception::class,
                'message' => $exception->getMessage(),
            ];
        }

        $result['elapsed_ms'] = (int) ((hrtime(true) - $startedAt) / 1_000_000);
        File::put($directory.'/'.$name.'.json', json_encode($result, JSON_THROW_ON_ERROR));
        exit($result['outcome'] === 'error' ? 1 : 0);
    }

    /** @return array{User, User, User, DoctorProfile, DoctorWorkplace, Checkup, Reservation, DoctorVisitSlot, Carbon} */
    private function bookableGraph(): array
    {
        $firstPatient = User::factory()->create();
        $secondPatient = User::factory()->create();
        $doctorUser = User::factory()->create();
        $doctorUser->syncRoles([UserRole::Doctor->value]);
        $specialty = Specialty::query()->create([
            'name' => 'Concurrent booking specialty',
            'slug' => 'concurrent-booking-specialty',
        ]);
        $doctor = DoctorProfile::query()->create([
            'user_id' => $doctorUser->id,
            'specialty_id' => $specialty->id,
            'verified' => true,
        ]);
        $hospital = MarketplaceHospital::query()->create([
            'name' => 'Concurrent Booking Hospital',
            'slug' => 'concurrent-booking-hospital',
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $category = CheckupCategory::query()->create([
            'name' => 'Concurrent Booking Category',
            'slug' => 'concurrent-booking-category',
        ]);
        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => 'Concurrent Booking Checkup',
            'slug' => 'concurrent-booking-checkup',
            'price' => 1_000_000,
        ]);
        $workplace->checkups()->attach($checkup->id, ['is_active' => true]);
        $originalRule = DoctorWorkingWindow::query()->create([
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'weekday' => Carbon::MONDAY,
            'starts_at' => '09:00',
            'ends_at' => '09:30',
        ]);
        $targetRule = DoctorWorkingWindow::query()->create([
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'weekday' => Carbon::MONDAY,
            'starts_at' => '10:00',
            'ends_at' => '10:30',
        ]);
        $start = Carbon::now()->addWeeks(2)->startOfWeek(Carbon::MONDAY)->setTime(10, 0);
        $originalSlot = DoctorVisitSlot::query()->create([
            'doctor_working_window_id' => $originalRule->id,
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'starts_at' => $start->copy()->setTime(9, 0),
            'ends_at' => $start->copy()->setTime(9, 30),
            'price' => $checkup->price,
            'currency' => $checkup->currency,
        ]);
        $targetSlot = DoctorVisitSlot::query()->create([
            'doctor_working_window_id' => $targetRule->id,
            'doctor_workplace_id' => $workplace->id,
            'checkup_id' => $checkup->id,
            'starts_at' => $start,
            'ends_at' => $start->copy()->addMinutes(30),
            'price' => $checkup->price,
            'currency' => $checkup->currency,
        ]);
        [$original] = app(BookingService::class)->createReservation(
            user: $secondPatient,
            slotPublicId: $originalSlot->public_id,
        );

        return [$firstPatient, $secondPatient, $doctorUser, $doctor, $workplace, $checkup, $original, $targetSlot, $start];
    }

    /** @param list<int> $children */
    private function waitForChildren(array $children, int $timeoutSeconds): array
    {
        $remaining = array_fill_keys($children, true);
        $exitCodes = [];
        $deadline = microtime(true) + $timeoutSeconds;

        while ($remaining !== [] && microtime(true) < $deadline) {
            foreach (array_keys($remaining) as $pid) {
                $result = pcntl_waitpid($pid, $status, WNOHANG);

                if ($result === $pid) {
                    $exitCodes[] = pcntl_wifexited($status) ? pcntl_wexitstatus($status) : 1;
                    unset($remaining[$pid]);
                }
            }

            if ($remaining !== []) {
                usleep(20_000);
            }
        }

        foreach (array_keys($remaining) as $pid) {
            posix_kill($pid, SIGTERM);
            pcntl_waitpid($pid, $status);
            $exitCodes[] = 1;
        }

        sort($exitCodes);

        return $exitCodes;
    }

    private function waitForFile(string $path, int $timeoutSeconds): void
    {
        $deadline = microtime(true) + $timeoutSeconds;

        while (! File::exists($path) && microtime(true) < $deadline) {
            usleep(10_000);
        }

        if (! File::exists($path)) {
            throw new RuntimeException("Timed out waiting for concurrency barrier: {$path}");
        }
    }

    /** @return array<string, mixed> */
    private function readResult(string $path): array
    {
        if (! File::exists($path)) {
            return ['outcome' => 'missing_result', 'path' => $path];
        }

        return json_decode(File::get($path), true, flags: JSON_THROW_ON_ERROR);
    }
}
