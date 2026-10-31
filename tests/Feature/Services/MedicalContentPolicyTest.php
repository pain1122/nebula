<?php

namespace Tests\Feature\Services;

use App\Support\MedicalContentPolicy;
use DomainException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class MedicalContentPolicyTest extends TestCase
{
    public function test_policy_revision_is_stable_and_changes_when_rules_change(): void
    {
        $policy = MedicalContentPolicy::current();
        $this->assertSame(64, strlen($policy->revision));
        $this->assertSame($policy->revision, MedicalContentPolicy::current()->revision);
        $rules = array_reverse($policy->rules, true);
        $rules['pdf']['forbidden_names'] = array_reverse($rules['pdf']['forbidden_names']);
        config(['medical_content' => $rules]);
        $this->assertSame($policy->revision, MedicalContentPolicy::current()->revision);
        config(['medical_content.image.max_pixels' => 1000000]);
        $this->assertNotSame($policy->revision, MedicalContentPolicy::current()->revision);
        $this->assertSame(16000000, $policy->rules['image']['max_pixels']);
    }

    #[DataProvider('invalidRules')]
    public function test_invalid_configuration_fails_closed(string $key, mixed $value): void
    {
        config([$key => $value]);
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Medical content policy is unavailable.');
        MedicalContentPolicy::current();
    }

    public static function invalidRules(): array
    {
        return [
            ['medical_content', null],
            ['medical_content.version', 2],
            ['medical_content.enabled', false],
            ['medical_content.image.max_pixels', '16000000'],
            ['medical_content.image.max_width', 0],
            ['medical_content.image.max_pixels', 16000001],
            ['medical_content.pdf.max_pages', -1],
            ['medical_content.pdf.forbidden_names', []],
            ['medical_content.pdf.forbidden_names', ['/JS#20']],
            ['medical_content.pdf.forbidden_names', ['key' => '/JS']],
            ['medical_content.resources.timeout_seconds', 21],
            ['medical_content.resources.address_space_bytes', 268435457],
            ['medical_content.resources.max_output_bytes', 4194305],
        ];
    }
}
