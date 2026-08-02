<?php

namespace Tests\Feature\Database;

use App\Models\AuditEvent;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FoundationPlatformSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_platform_primitives_and_monitoring_tables_exist(): void
    {
        foreach ([
            'setting_definitions',
            'setting_values',
            'features',
            'outbox_events',
            'public_media_attachments',
            'tenant_instances',
            'tenant_feature_overrides',
            'tenant_health_snapshots',
        ] as $table) {
            $this->assertTrue(Schema::hasTable($table), "Expected {$table} to exist.");
        }

        $this->assertTrue(Schema::hasColumns('audit_events', [
            'public_id',
            'actor_public_id',
            'actor_name_snapshot',
            'subject_public_id',
            'reason',
            'outcome',
            'correlation_id',
        ]));
        $this->assertTrue(Schema::hasColumns('tenant_health_snapshots', [
            'heartbeat_nonce',
            'health_status',
            'component_statuses',
            'error_fingerprints',
            'aggregate_counters',
            'observed_at',
        ]));

        $this->assertTrue(Schema::hasColumns('public_media_attachments', [
            'attachable_type',
            'attachable_id',
            'disk',
            'path',
            'checksum_sha256',
            'archived_at',
        ]));

        foreach (['patient_id', 'reservation_id', 'payment_id', 'questionnaire_submission_id', 'medical_file_id'] as $column) {
            $this->assertFalse(Schema::hasColumn('tenant_health_snapshots', $column));
        }
    }

    public function test_audit_redaction_is_recursive_for_secrets_pii_and_medical_payloads(): void
    {
        $actor = User::factory()->create();
        $subject = User::factory()->create();
        $request = Request::create('/api/admin/users/'.$subject->id, 'PUT');

        app(AuditLogger::class)->log(
            request: $request,
            actor: $actor,
            action: 'test.redaction',
            subject: $subject,
            riskLevel: 'critical',
            before: null,
            after: [
                'email' => 'allowed@example.test',
                'phone' => '09120000000',
                'nested' => [
                    'api_token' => 'secret-token',
                    'answers_json' => [['score' => 10]],
                    'safe_state' => 'active',
                ],
            ],
        );

        $event = AuditEvent::query()->sole();

        $this->assertSame('allowed@example.test', $event->after['email']);
        $this->assertArrayNotHasKey('phone', $event->after);
        $this->assertArrayNotHasKey('api_token', $event->after['nested']);
        $this->assertArrayNotHasKey('answers_json', $event->after['nested']);
        $this->assertSame('active', $event->after['nested']['safe_state']);
        $this->assertSame(26, strlen($event->public_id));
        $this->assertNotNull($event->correlation_id);
    }
}
