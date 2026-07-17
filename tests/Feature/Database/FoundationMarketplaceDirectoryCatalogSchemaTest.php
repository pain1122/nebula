<?php

namespace Tests\Feature\Database;

use App\Enums\HospitalListingRequestStatus;
use App\Models\Checkup;
use App\Models\CheckupCategory;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\HospitalListingRequest;
use App\Models\MarketplaceHospital;
use App\Models\Specialty;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationMarketplaceDirectoryCatalogSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_marketplace_directory_doctor_and_catalog_structures_exist(): void
    {
        $this->assertTrue(Schema::hasColumns('marketplace_hospitals', [
            'public_id', 'timezone', 'filter_metadata', 'is_active', 'archived_at', 'archived_by',
        ]));
        $this->assertTrue(Schema::hasColumns('hospital_listing_requests', [
            'public_id', 'requesting_user_id', 'status', 'reviewed_by', 'marketplace_hospital_id',
        ]));
        $this->assertTrue(Schema::hasTable('doctor_specialty'));
        $this->assertTrue(Schema::hasColumns('doctor_workplaces', [
            'public_id', 'doctor_profile_id', 'marketplace_hospital_id', 'is_active', 'archived_at',
        ]));
        $this->assertTrue(Schema::hasColumns('checkups', [
            'public_id', 'currency', 'default_duration_minutes', 'is_active', 'deleted_at',
        ]));
    }

    public function test_marketplace_records_receive_public_ids_and_keep_local_ownership(): void
    {
        $user = User::factory()->create();
        $specialty = Specialty::query()->create([
            'name' => 'Cardiology',
            'slug' => 'cardiology',
            'level' => 0,
        ]);
        $doctor = DoctorProfile::query()->create([
            'user_id' => $user->id,
            'specialty_id' => $specialty->id,
        ]);
        $doctor->specialties()->attach($specialty, ['is_primary' => true]);

        $hospital = MarketplaceHospital::query()->create([
            'name' => 'Central Hospital',
            'slug' => 'central-hospital',
            'city' => 'Tehran',
        ]);
        $workplace = DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
        $request = HospitalListingRequest::query()->create([
            'requesting_user_id' => $user->id,
            'proposed_name' => 'Requested Hospital',
        ]);
        $category = CheckupCategory::query()->create([
            'name' => 'General',
            'slug' => 'general',
        ]);
        $checkup = Checkup::query()->create([
            'checkup_category_id' => $category->id,
            'title' => 'Basic Checkup',
            'slug' => 'basic-checkup',
            'price' => 500_000,
        ]);

        foreach ([$specialty, $doctor, $hospital, $workplace, $request, $category, $checkup] as $model) {
            $this->assertSame(26, strlen($model->public_id));
        }

        $this->assertSame(HospitalListingRequestStatus::Pending, $request->status);
        $this->assertSame('IRR', $checkup->currency);
        $this->assertSame(30, $checkup->default_duration_minutes);
        $this->assertSame($hospital->id, $workplace->hospital->id);
        $this->assertCount(1, $doctor->specialties);
    }

    public function test_a_doctor_cannot_have_duplicate_workplaces_for_one_hospital(): void
    {
        $user = User::factory()->create();
        $doctor = DoctorProfile::query()->create(['user_id' => $user->id]);
        $hospital = MarketplaceHospital::query()->create([
            'name' => 'Unique Hospital',
            'slug' => 'unique-hospital',
        ]);

        DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);

        $this->expectException(QueryException::class);

        DoctorWorkplace::query()->create([
            'doctor_profile_id' => $doctor->id,
            'marketplace_hospital_id' => $hospital->id,
        ]);
    }
}
