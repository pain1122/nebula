<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthTokenTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_login_issues_token_with_server_time_expiration(): void
    {
        config(['sanctum.expiration' => 60]);
        $this->travelTo(Carbon::parse('2026-06-28 12:00:00', 'UTC'));

        $user = User::factory()->create();
        $expectedExpiration = now()->addMinutes(60);

        $response = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'mobile',
            'expires_at' => '2099-01-01T00:00:00Z',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('data.expires_at', $expectedExpiration->toISOString());

        $token = PersonalAccessToken::query()->firstOrFail();

        $this->assertTrue($token->expires_at->equalTo($expectedExpiration));
    }

    public function test_api_refresh_requires_bearer_token_and_does_not_mint_from_session(): void
    {
        config(['sanctum.expiration' => 60]);

        $user = User::factory()->create();

        $this->actingAs($user, 'web')
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized()
            ->assertJsonPath('message', 'Bearer token required for token refresh.');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_api_refresh_rotates_bearer_token_with_server_time_expiration(): void
    {
        config(['sanctum.expiration' => 30]);
        $this->travelTo(Carbon::parse('2026-06-28 12:00:00', 'UTC'));

        $user = User::factory()->create();
        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
            'device_name' => 'mobile',
        ]);

        $oldToken = $login->json('data.token');

        $this->travelTo(Carbon::parse('2026-06-28 12:10:00', 'UTC'));
        $expectedExpiration = now()->addMinutes(30);

        $refresh = $this
            ->withHeader('Authorization', 'Bearer '.$oldToken)
            ->postJson('/api/auth/refresh', [
                'device_name' => 'mobile-refresh',
            ]);

        $refresh
            ->assertOk()
            ->assertJsonPath('data.expires_at', $expectedExpiration->toISOString());

        $this->assertNotSame($oldToken, $refresh->json('data.token'));
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $token = PersonalAccessToken::query()->firstOrFail();

        $this->assertSame('mobile-refresh', $token->name);
        $this->assertTrue($token->expires_at->equalTo($expectedExpiration));
    }

    public function test_api_logout_revokes_current_bearer_token(): void
    {
        config(['sanctum.expiration' => 60]);

        $user = User::factory()->create();
        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this
            ->withHeader('Authorization', 'Bearer '.$login->json('data.token'))
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_expired_api_token_is_rejected_using_server_time(): void
    {
        config(['sanctum.expiration' => 1]);
        $this->travelTo(Carbon::parse('2026-06-28 12:00:00', 'UTC'));

        $user = User::factory()->create();
        $login = $this->postJson('/api/auth/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->travelTo(Carbon::parse('2026-06-28 12:02:00', 'UTC'));

        $this
            ->withHeader('Authorization', 'Bearer '.$login->json('data.token'))
            ->getJson('/api/auth/me')
            ->assertUnauthorized();
    }

    public function test_me_response_uses_an_explicit_safe_field_allowlist(): void
    {
        $user = User::factory()->create([
            'phone' => '09120000000',
            'NID' => '1234567890',
            'bio' => 'private profile data',
        ]);

        $response = $this
            ->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me')
            ->assertOk();

        $this->assertEqualsCanonicalizing([
            'id',
            'name',
            'email',
            'roles',
            'doctor_profile',
        ], array_keys($response->json('data')));
    }
}
