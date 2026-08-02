<?php

namespace Tests\Feature\Api;

use App\Enums\UserRole;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\ReservationStatus;
use App\Models\Specialty;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ListingFilterSortTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkup_doctors_list_filters_and_sorts_only_attached_verified_doctors(): void
    {
        $patient = $this->userWithRole(UserRole::Patient, 'Patient User');
        $specialty = $this->specialty('cardiology');
        $checkup = $this->checkup('Heart screening');

        $alpha = $this->doctor('Alpha Doctor', $specialty, fee: 100000, verified: true);
        $beta = $this->doctor('Beta Doctor', $specialty, fee: 300000, verified: true);
        $hidden = $this->doctor('Hidden Doctor', $specialty, fee: 500000, verified: true);
        $unverified = $this->doctor('Unverified Doctor', $specialty, fee: 400000, verified: false);

        foreach ([$alpha, $beta, $unverified] as $doctor) {
            $doctor->workplaces()->firstOrFail()->checkups()->attach($checkup->id);
        }

        $response = $this
            ->actingAs($patient, 'sanctum')
            ->getJson('/api/checkups/'.$checkup->id.'/doctors?min_fee=100000&sort_by=fee&sort_dir=desc')
            ->assertOk();

        $ids = array_column($response->json('data'), 'doctor_profile_id');

        $this->assertSame([$beta->id, $alpha->id], $ids);
        $this->assertNotContains($hidden->id, $ids);
        $this->assertNotContains($unverified->id, $ids);
    }

    public function test_admin_reservations_filter_search_and_sort_by_related_columns(): void
    {
        $admin = $this->userWithRole(UserRole::Admin, 'Admin User');
        $specialty = $this->specialty('general');
        $doctor = $this->doctor('Doctor One', $specialty, fee: 100000, verified: true);
        $alpha = $this->checkup('Alpha checkup');
        $beta = $this->checkup('Beta checkup');
        $alice = $this->userWithRole(UserRole::Patient, 'Alice Patient');
        $zoe = $this->userWithRole(UserRole::Patient, 'Zoe Patient');

        $aliceReservation = $this->reservation($alice, $doctor, $beta, 'paid');
        $zoeReservation = $this->reservation($zoe, $doctor, $alpha, 'unpaid');

        $sorted = $this
            ->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/reservations?sort_by=patient_name&sort_dir=asc')
            ->assertOk()
            ->json('data');

        $this->assertSame([$aliceReservation->id, $zoeReservation->id], array_column($sorted, 'id'));

        $filtered = $this
            ->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/reservations?payment_status=paid&q=Beta&sort_by=checkup_title')
            ->assertOk()
            ->json('data');

        $this->assertSame([$aliceReservation->id], array_column($filtered, 'id'));
    }

    private function userWithRole(UserRole $role, string $name): User
    {
        $user = User::factory()->create([
            'name' => $name,
            'first_name' => strtok($name, ' ') ?: $name,
            'last_name' => trim(strstr($name, ' ') ?: 'User'),
        ]);

        $user->syncRoles([$role->value]);

        return $user;
    }

    private function specialty(string $slug): Specialty
    {
        return Specialty::query()->create([
            'name' => ucfirst($slug),
            'slug' => $slug.'-'.uniqid(),
            'level' => 0,
        ]);
    }

    private function checkup(string $title): Checkup
    {
        $category = CheckupCategory::query()->create([
            'name' => $title.' category',
            'slug' => str($title)->slug().'-category-'.uniqid(),
            'description' => null,
        ]);

        return Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => $title,
            'slug' => str($title)->slug().'-'.uniqid(),
            'description' => null,
            'price' => 100000,
        ]);
    }

    private function doctor(string $name, Specialty $specialty, int $fee, bool $verified): DoctorProfile
    {
        $user = $this->userWithRole(UserRole::Doctor, $name);

        $doctor = DoctorProfile::query()->create([
            'user_id' => $user->id,
            'specialty_id' => $specialty->id,
            'phone' => '021'.random_int(10000000, 99999999),
            'experience_years' => 5,
            'fee' => $fee,
            'bio' => null,
            'availability' => [
                ['day' => 'mon', 'slots' => [['09:00', '12:00']]],
            ],
            'verified' => $verified,
        ]);

        $hospital = MarketplaceHospital::query()->create([
            'name' => $name.' Hospital',
            'slug' => str($name)->slug().'-hospital-'.uniqid(),
        ]);
        DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);

        return $doctor;
    }

    private function reservation(User $patient, DoctorProfile $doctor, Checkup $checkup, string $paymentStatus): Reservation
    {
        $start = Carbon::now()->addWeek()->setTime(10, 0);

        $reservation = Reservation::query()->create([
            'user_id' => $patient->id,
            'doctor_profile_id' => $doctor->id,
            'doctor_workplace_id' => $doctor->workplaces()->value('id'),
            'checkup_id' => $checkup->id,
            'starts_at' => $start,
            'ends_at' => $start->copy()->addMinutes(30),
            'duration_minutes' => 30,
            'timezone' => 'Asia/Tehran',
            'hold_expires_at' => now()->addHour(),
            'hospital_name_snapshot' => $doctor->workplaces()->first()->hospital->name,
            'doctor_name_snapshot' => $doctor->user->name,
            'checkup_title_snapshot' => $checkup->title,
            'price_snapshot' => $checkup->price,
            'currency_snapshot' => 'IRR',
            'status' => $paymentStatus === 'paid' ? ReservationStatus::Confirmed : ReservationStatus::Pending,
        ]);

        Payment::query()->create([
            'reservation_id' => $reservation->id,
            'amount' => $checkup->price,
            'currency' => 'IRR',
            'status' => $paymentStatus,
            'provider' => 'stripe',
        ]);

        return $reservation;
    }
}
