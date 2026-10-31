<?php

namespace Tests\Feature\Services;

use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorVisitSlot;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Specialty;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\BookingService;
use App\Services\DoctorScheduleService;
use App\Services\DoctorVisitSlotControlService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Mockery\MockInterface;
use RuntimeException;
use Tests\TestCase;

class DoctorVisitSlotControlServiceTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\IsolatedProfileApplication;

    public function test_doctor_can_change_only_price_and_active_state_for_one_slot(): void
    {
        [$doctorUser, , , , $slots] = $this->scheduleGraph();
        $slot = $slots->first();

        $changed = app(DoctorVisitSlotControlService::class)->change(
            $this->request(),
            $doctorUser,
            $slot->workplace,
            $slot->checkup,
            'slot',
            $slot->starts_at,
            $slot,
            false,
            1_500_000,
            'Doctor closed this occurrence.',
        )->first();

        $this->assertFalse($changed->is_active);
        $this->assertSame(1_500_000, $changed->price);
        $this->assertTrue($changed->starts_at->equalTo($slot->starts_at));
        $this->assertDatabaseHas('audit_events', ['action' => 'doctor.visit_slots.controlled']);
    }

    public function test_day_and_calendar_week_controls_target_only_matching_future_slots(): void
    {
        [$doctorUser, , $workplace, $checkup, $slots] = $this->scheduleGraph(21);
        $firstMonday = $this->futureMonday();
        $firstDaySlots = $slots->filter(
            fn (DoctorVisitSlot $slot): bool => $slot->starts_at->copy()->setTimezone('Asia/Tehran')->isSameDay($firstMonday)
        );

        app(DoctorVisitSlotControlService::class)->change(
            $this->request(),
            $doctorUser,
            $workplace,
            $checkup,
            'day',
            $firstMonday,
            null,
            false,
            null,
            'Close this date.',
        );

        $this->assertSame(0, DoctorVisitSlot::query()->whereKey($firstDaySlots->modelKeys())->where('is_active', true)->count());
        $this->assertGreaterThan(0, DoctorVisitSlot::query()->whereNotIn('id', $firstDaySlots->modelKeys())->where('is_active', true)->count());

        app(DoctorVisitSlotControlService::class)->change(
            $this->request(),
            $doctorUser,
            $workplace,
            $checkup,
            'week',
            $firstMonday->copy()->addWeek(),
            null,
            null,
            1_700_000,
            'Special calendar-week price.',
        );

        $secondMonday = $firstMonday->copy()->addWeek()->toDateString();
        $secondWeekPrices = DoctorVisitSlot::query()->get()->filter(
            fn (DoctorVisitSlot $slot): bool => $slot->starts_at->copy()->setTimezone('Asia/Tehran')->toDateString() === $secondMonday
        )->pluck('price')->unique()->values()->all();
        $this->assertSame([1_700_000], $secondWeekPrices);
    }

    public function test_bulk_control_excludes_reserved_slots_and_preserves_financial_snapshot(): void
    {
        [$doctorUser, $patient, $workplace, $checkup, $slots] = $this->scheduleGraph();
        $reservedSlot = $slots->first();
        [$reservation, $payment] = app(BookingService::class)->createReservation($patient, $reservedSlot->public_id);

        app(DoctorVisitSlotControlService::class)->change(
            $this->request(),
            $doctorUser,
            $workplace,
            $checkup,
            'day',
            $this->futureMonday(),
            null,
            false,
            2_000_000,
            'Close remaining availability.',
        );

        $this->assertTrue($reservedSlot->fresh()->is_active);
        $this->assertSame(1_200_000, $reservedSlot->fresh()->price);
        $this->assertSame(1_200_000, $reservation->fresh()->price_snapshot);
        $this->assertSame(1_200_000, $payment->fresh()->amount);
        $this->assertSame(0, DoctorVisitSlot::query()->whereKeyNot($reservedSlot->id)->where('is_active', true)->count());
    }

    public function test_another_doctor_cannot_control_the_schedule(): void
    {
        [, , , , $slots] = $this->scheduleGraph();
        $slot = $slots->first();
        $otherUser = User::factory()->doctor()->create();
        DoctorProfile::factory()->create(['user_id' => $otherUser->id]);

        $this->expectException(DomainException::class);
        app(DoctorVisitSlotControlService::class)->change(
            $this->request(),
            $otherUser,
            $slot->workplace,
            $slot->checkup,
            'slot',
            $slot->starts_at,
            $slot,
            false,
            null,
            'Not my schedule.',
        );
    }

    public function test_audit_failure_rolls_back_all_targeted_slots(): void
    {
        [$doctorUser, , $workplace, $checkup, $slots] = $this->scheduleGraph();
        $this->mock(AuditLogger::class, function (MockInterface $mock): void {
            $mock->shouldReceive('log')->once()->andThrow(new RuntimeException('audit unavailable'));
        });

        try {
            app(DoctorVisitSlotControlService::class)->change(
                $this->request(),
                $doctorUser,
                $workplace,
                $checkup,
                'day',
                $this->futureMonday(),
                null,
                false,
                9_000_000,
                'Must be audited.',
            );
            $this->fail('Expected audit failure to escape the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('audit unavailable', $exception->getMessage());
        }

        $this->assertSame(0, DoctorVisitSlot::query()->whereKey($slots->modelKeys())->where('is_active', false)->count());
        $this->assertSame([1_200_000], DoctorVisitSlot::query()->whereKey($slots->modelKeys())->pluck('price')->unique()->all());
    }

    /** @return array{User, User, DoctorWorkplace, Checkup, \Illuminate\Database\Eloquent\Collection<int, DoctorVisitSlot>} */
    private function scheduleGraph(int $effectiveDays = 0): array
    {
        $doctorUser = User::factory()->doctor()->create();
        $patient = User::factory()->patient()->create();
        $specialty = Specialty::query()->create(['name' => uniqid('Specialty '), 'slug' => uniqid('specialty-')]);
        $doctor = DoctorProfile::query()->create([
            'user_id' => $doctorUser->id,
            'specialty_id' => $specialty->id,
            'verified' => true,
        ]);
        $hospital = MarketplaceHospital::query()->create([
            'name' => uniqid('Hospital '),
            'slug' => uniqid('hospital-'),
            'timezone' => 'Asia/Tehran',
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $category = CheckupCategory::query()->create(['name' => uniqid('Category '), 'slug' => uniqid('category-')]);
        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => uniqid('Checkup '),
            'slug' => uniqid('checkup-'),
            'price' => 1_000_000,
            'currency' => 'IRR',
        ]);
        $workplace->checkups()->attach($checkup->id, [
            'price_override' => 1_200_000,
            'currency_override' => 'IRR',
            'is_active' => true,
        ]);
        app(DoctorScheduleService::class)->replaceWeeklyRules($workplace, [[
            'day' => 'mon',
            'windows' => [[
                'checkup_id' => $checkup->id,
                'start' => '09:00',
                'end' => '11:00',
                'duration_minutes' => 30,
                'effective_from' => $this->futureMonday()->toDateString(),
                'effective_until' => $this->futureMonday()->addDays($effectiveDays)->toDateString(),
                'breaks' => [],
            ]],
        ]]);

        return [$doctorUser, $patient, $workplace, $checkup, $workplace->visitSlots()->orderBy('starts_at')->get()];
    }

    private function request(): Request
    {
        return Request::create('/api/doctor/visit-slots', 'PATCH');
    }

    private function futureMonday(): Carbon
    {
        return Carbon::now('Asia/Tehran')->addWeeks(2)->startOfWeek(Carbon::MONDAY)->startOfDay();
    }
}
