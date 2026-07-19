<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SanctumSessionSecurityTest extends TestCase
{
    use RefreshDatabase;

    private const SPA_ORIGIN = 'http://localhost:3000';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cors.allowed_origins' => [self::SPA_ORIGIN],
            'sanctum.stateful' => ['localhost:3000'],
        ]);
    }

    public function test_csrf_cookie_endpoint_supports_credentials_for_allowed_origin(): void
    {
        $this
            ->withHeaders($this->statefulHeaders())
            ->get('/sanctum/csrf-cookie')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', self::SPA_ORIGIN)
            ->assertHeader('Access-Control-Allow-Credentials', 'true')
            ->assertCookie('XSRF-TOKEN');
    }

    public function test_csrf_cookie_endpoint_does_not_reflect_an_unknown_origin(): void
    {
        $this
            ->withHeaders([
                'Origin' => 'https://attacker.example',
                'Referer' => 'https://attacker.example/',
            ])
            ->get('/sanctum/csrf-cookie')
            ->assertNoContent()
            ->assertHeader('Access-Control-Allow-Origin', self::SPA_ORIGIN);
    }

    public function test_stateful_write_rejects_a_missing_csrf_token(): void
    {
        $this->app->instance('env', 'local');
        $user = User::factory()->create();

        $this
            ->actingAs($user, 'web')
            ->withHeaders($this->statefulHeaders())
            ->withSession(['_token' => 'known-csrf-token'])
            ->postJson('/api/auth/confirm-password', [
                'password' => 'password',
            ])
            ->assertStatus(419);
    }

    public function test_stateful_write_accepts_a_matching_csrf_token(): void
    {
        $this->app->instance('env', 'local');
        $user = User::factory()->create();

        $this
            ->actingAs($user, 'web')
            ->withHeaders(array_merge($this->statefulHeaders(), [
                'X-CSRF-TOKEN' => 'known-csrf-token',
            ]))
            ->withSession(['_token' => 'known-csrf-token'])
            ->postJson('/api/auth/confirm-password', [
                'password' => 'password',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Password confirmed.');
    }

    /**
     * @return array<string, string>
     */
    private function statefulHeaders(): array
    {
        return [
            'Origin' => self::SPA_ORIGIN,
            'Referer' => self::SPA_ORIGIN.'/',
        ];
    }
}
