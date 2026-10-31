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
use App\Services\BookingService;
use App\Services\DoctorScheduleService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class DeclaredVisitSlotTest extends TestCase
{
    use RefreshDatabase;

    public function test_rule_materialization_creates_persistent_slots_around_breaks(): void
    {
        [, , , , $slots] = $this->bookableGraph();

        $this->assertCount(5, $slots);
        $this->assertSame(5, $slots->pluck('public_id')->unique()->count());
        $this->assertSame([
            '09:00-09:30',
            '09:30-10:00',
            '10:30-11:00',
            '11:00-11:30',
            '11:30-12:00',
        ], $slots->map(fn (DoctorVisitSlot $slot): string => $this->localRange($slot))->all());
    }

    public function test_booking_uses_only_the_slot_id_and_snapshots_slot_facts(): void
    {
        [$patient, , , , $slots] = $this->bookableGraph();
        $slot = $slots->first();
        $slot->update(['price' => 1_300_000]);

        [$reservation, $payment] = app(BookingService::class)->createReservation(
            user: $patient,
            slotPublicId: $slot->public_id,
        );

        $this->assertSame($slot->id, $reservation->doctor_visit_slot_id);
        $this->assertSame(30, $reservation->duration_minutes);
        $this->assertTrue($reservation->starts_at->equalTo($slot->starts_at));
        $this->assertTrue($reservation->ends_at->equalTo($slot->ends_at));
        $this->assertSame(1_300_000, $reservation->price_snapshot);
        $this->assertSame(1_300_000, $payment->amount);
    }

    public function test_api_returns_public_slot_ids_and_prohibits_timestamp_authority(): void
    {
        [$patient, $doctor, $workplace, $checkup, $slots] = $this->bookableGraph();
        $slot = $slots->first();

        $this->actingAs($patient, 'sanctum')
            ->getJson('/api/doctors/'.$doctor->id.'/availability?'.http_build_query([
                'checkup_id' => $checkup->id,
                'workplace_id' => $workplace->id,
                'from' => $this->futureMonday()->toDateString(),
                'to' => $this->futureMonday()->toDateString(),
            ]))
            ->assertOk()
            ->assertJsonPath('data.0.slot_id', $slot->public_id)
            ->assertJsonPath('data.0.duration_minutes', 30)
            ->assertJsonPath('data.0.price', 1_200_000);

        $this->actingAs($patient, 'sanctum')
            ->postJson('/api/reservations', [
                'slot_id' => $slot->public_id,
                'starts_at' => $slot->starts_at->format('Y-m-d\TH:i'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('starts_at');
    }

    public function test_invalid_breaks_and_overlapping_working_windows_do_not_replace_rules(): void
    {
        [, , $workplace, $checkup] = $this->bookableGraph();
        $originalRuleId = $workplace->workingWindows()->where('is_active', true)->value('id');

        try {
            app(DoctorScheduleService::class)->replaceWeeklyRules($workplace, [[
                'day' => 'mon',
                'windows' => [
                    $this->window($checkup, '09:00', '11:00'),
                    $this->window($checkup, '10:30', '12:00'),
                ],
            ]]);
            $this->fail('Expected overlapping working windows to be rejected.');
        } catch (ValidationException $exception) {
            $this->assertSame(['overlapping_working_windows'], $exception->errors()['availability']);
        }

        try {
            $invalid = $this->window($checkup, '09:00', '12:00');
            $invalid['breaks'] = [['start' => '08:30', 'end' => '09:30']];
            app(DoctorScheduleService::class)->replaceWeeklyRules($workplace, [[
                'day' => 'mon',
                'windows' => [$invalid],
            ]]);
            $this->fail('Expected the out-of-window break to be rejected.');
        } catch (ValidationException $exception) {
            $this->assertSame(['invalid_break_window'], $exception->errors()['availability']);
        }

        $this->assertSame($originalRuleId, $workplace->workingWindows()->where('is_active', true)->value('id'));
    }

    public function test_doctor_discovery_returns_eligible_workplaces_and_excludes_inactive_ones(): void
    {
        [$patient, $doctor, $workplace, $checkup] = $this->bookableGraph();
        $this->actingAs($patient, 'sanctum')
            ->getJson('/api/checkups/'.$checkup->id.'/doctors')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.doctor_profile_id', $doctor->id)
            ->assertJsonPath('data.0.workplaces.0.id', $workplace->id)
            ->assertJsonPath('data.0.workplaces.0.timezone', 'Asia/Tehran');

        $workplace->forceFill(['is_active' => false])->save();
        $this->getJson('/api/checkups/'.$checkup->id.'/doctors')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_reservation_lists_show_booked_money_after_catalog_price_changes(): void
    {
        [$patient, $doctor, , $checkup, $slots] = $this->bookableGraph();
        [$reservation] = app(BookingService::class)->createReservation($patient, $slots->first()->public_id);
        $checkup->update(['price' => 999]);

        foreach ([$patient, $doctor->user] as $actor) {
            $path = $actor->is($patient) ? '/api/my/reservations' : '/api/doctor/reservations';
            $this->actingAs($actor, 'sanctum')->getJson($path)
                ->assertOk()
                ->assertJsonPath('data.data.0.public_id', $reservation->public_id)
                ->assertJsonPath('data.data.0.booked_amount', 1_200_000)
                ->assertJsonPath('data.data.0.booked_currency', 'IRR')
                ->assertJsonPath('data.data.0.hold_expires_at', $reservation->hold_expires_at->toIso8601String());
        }
    }

    public function test_materialized_slot_time_and_ownership_are_immutable(): void
    {
        [, , , , $slots] = $this->bookableGraph();
        $slot = $slots->first();

        $this->expectException(DomainException::class);
        $slot->update(['starts_at' => $slot->starts_at->copy()->addMinutes(5)]);
    }

    /** @return array{User, DoctorProfile, DoctorWorkplace, Checkup, \Illuminate\Database\Eloquent\Collection<int, DoctorVisitSlot>} */
    private function bookableGraph(): array
    {
        $patient = User::factory()->create();
        $doctorUser = User::factory()->doctor()->create();
        $specialty = Specialty::query()->create([
            'name' => 'Schedule specialty '.uniqid(),
            'slug' => 'schedule-specialty-'.uniqid(),
        ]);
        $doctor = DoctorProfile::query()->create([
            'user_id' => $doctorUser->id,
            'specialty_id' => $specialty->id,
            'verified' => true,
        ]);
        $hospital = MarketplaceHospital::query()->create([
            'name' => 'Schedule Hospital',
            'slug' => 'schedule-hospital-'.uniqid(),
            'timezone' => 'Asia/Tehran',
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $category = CheckupCategory::query()->create([
            'name' => 'Schedule Category',
            'slug' => 'schedule-category-'.uniqid(),
        ]);
        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => 'Schedule Checkup',
            'slug' => 'schedule-checkup-'.uniqid(),
            'price' => 1_000_000,
            'currency' => 'IRR',
        ]);
        $workplace->checkups()->attach($checkup->id, [
            'price_override' => 1_200_000,
            'currency_override' => 'IRR',
            'is_active' => true,
        ]);

        $window = $this->window($checkup, '09:00', '12:00');
        $window['breaks'] = [['start' => '10:00', 'end' => '10:30']];
        app(DoctorScheduleService::class)->replaceWeeklyRules($workplace, [[
            'day' => 'mon',
            'windows' => [$window],
        ]]);
        $slots = $workplace->visitSlots()->orderBy('starts_at')->get();

        return [$patient, $doctor, $workplace, $checkup, $slots];
    }

    /** @return array<string, mixed> */
    private function window(Checkup $checkup, string $start, string $end): array
    {
        return [
            'checkup_id' => $checkup->id,
            'start' => $start,
            'end' => $end,
            'duration_minutes' => 30,
            'effective_from' => $this->futureMonday()->toDateString(),
            'effective_until' => $this->futureMonday()->toDateString(),
            'breaks' => [],
        ];
    }

    private function localRange(DoctorVisitSlot $slot): string
    {
        return $slot->starts_at->copy()->setTimezone('Asia/Tehran')->format('H:i').'-'.
            $slot->ends_at->copy()->setTimezone('Asia/Tehran')->format('H:i');
    }

    private function futureMonday(): Carbon
    {
        return Carbon::now('Asia/Tehran')->addWeeks(2)->startOfWeek(Carbon::MONDAY)->startOfDay();
    }
}
