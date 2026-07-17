<?php

namespace Tests\Feature\Database;

use App\Models\AuditEvent;
use App\Models\Feature;
use App\Models\HospitalListingRequest;
use App\Models\Lead;
use App\Models\MarketplaceHospital;
use App\Models\OutboxEvent;
use App\Models\PaymentAttempt;
use App\Models\QuestionnaireChoice;
use App\Models\QuestionnaireQuestion;
use App\Models\QuestionnaireRecommendation;
use App\Models\QuestionnaireSubmission;
use App\Models\ReservationFile;
use App\Models\ReservationNote;
use App\Models\ReservationRatingOption;
use App\Models\SettingValue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FoundationFactorySmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_foundation_entity_factories_create_valid_records(): void
    {
        $this->assertTrue(MarketplaceHospital::factory()->create()->exists);
        $this->assertTrue(HospitalListingRequest::factory()->create()->exists);
        $this->assertTrue(QuestionnaireQuestion::factory()->create()->exists);
        $this->assertTrue(QuestionnaireChoice::factory()->create()->exists);
        $this->assertTrue(QuestionnaireRecommendation::factory()->create()->exists);
        $this->assertTrue(QuestionnaireSubmission::factory()->create()->exists);
        $this->assertTrue(Lead::factory()->create()->exists);
        $this->assertTrue(ReservationNote::factory()->create()->exists);
        $this->assertTrue(ReservationFile::factory()->create()->exists);
        $this->assertTrue(ReservationRatingOption::factory()->create()->exists);
        $this->assertTrue(PaymentAttempt::factory()->create()->exists);
        $this->assertTrue(AuditEvent::factory()->create()->exists);
        $this->assertTrue(SettingValue::factory()->create()->exists);
        $this->assertTrue(Feature::factory()->create()->exists);
        $this->assertTrue(OutboxEvent::factory()->create()->exists);
    }
}
