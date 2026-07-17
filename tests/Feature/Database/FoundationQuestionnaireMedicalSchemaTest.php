<?php

namespace Tests\Feature\Database;

use App\Models\Questionnaire;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Models\UserProfile;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationQuestionnaireMedicalSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_questionnaire_lead_and_medical_tables_have_retention_metadata(): void
    {
        $this->assertTrue(Schema::hasColumns('questionnaires', [
            'public_id', 'author_user_id', 'version', 'published_at', 'deleted_at',
        ]));
        $this->assertTrue(Schema::hasColumns('questionnaire_submissions', [
            'public_id', 'questionnaire_version', 'guest_token_hash', 'data_classification',
            'retention_until', 'archived_by', 'deleted_at',
        ]));
        $this->assertFalse(Schema::hasColumn('questionnaire_submissions', 'guest_token'));
        $this->assertTrue(Schema::hasColumns('leads', [
            'public_id', 'consent_granted', 'consent_recorded_at', 'consent_source', 'retention_until',
        ]));
        $this->assertTrue(Schema::hasColumns('reservation_files', [
            'public_id', 'uploaded_by', 'disk', 'path', 'mime_type', 'size_bytes', 'checksum_sha256',
            'classification', 'scan_status', 'retention_until', 'deleted_at',
        ]));
        $this->assertTrue(Schema::hasColumns('reservation_notes', [
            'public_id', 'author_name_snapshot', 'type', 'visibility', 'deleted_at',
        ]));
        $this->assertTrue(Schema::hasColumns('user_profiles', [
            'public_id', 'privacy_reviewed_at', 'retention_until',
        ]));
    }

    public function test_submission_history_restricts_physical_questionnaire_deletion(): void
    {
        $questionnaire = Questionnaire::query()->create([
            'title' => 'Retained Questionnaire',
            'slug' => 'retained-questionnaire',
            'status' => 'published',
        ]);
        QuestionnaireSubmission::query()->create([
            'questionnaire_id' => $questionnaire->id,
            'questionnaire_version' => $questionnaire->version,
            'questionnaire_title' => $questionnaire->title,
            'questionnaire_slug' => $questionnaire->slug,
            'answers_json' => [],
            'total_score' => 0,
        ]);

        $this->expectException(QueryException::class);

        $questionnaire->forceDelete();
    }

    public function test_medical_profile_restricts_physical_user_deletion(): void
    {
        $user = User::factory()->create();
        UserProfile::query()->create([
            'user_id' => $user->id,
            'blood_type' => 'O+',
        ]);

        $this->expectException(QueryException::class);

        $user->delete();
    }
}
