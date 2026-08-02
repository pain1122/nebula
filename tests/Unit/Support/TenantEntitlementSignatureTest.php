<?php

namespace Tests\Unit\Support;

use App\Support\TenantEntitlementSignature;
use Carbon\CarbonImmutable;
use LogicException;
use Tests\TestCase;

class TenantEntitlementSignatureTest extends TestCase
{
    public function test_ed25519_signature_is_bound_to_the_complete_entitlement_payload(): void
    {
        [$seed, $publicKey] = $this->keyMaterial("\x01");
        $this->configureKey('primary', $seed, $publicKey);
        $signature = app(TenantEntitlementSignature::class);
        $issuedAt = CarbonImmutable::parse('2026-08-02 10:00:00', 'UTC');
        $expiresAt = $issuedAt->addMonth();

        $signed = $signature->sign(
            'tenant-installation-1',
            'tenant.foundation',
            true,
            'foundation-v1',
            $issuedAt,
            $expiresAt,
        );

        $this->assertTrue($signature->verify(
            'tenant-installation-1',
            'tenant.foundation',
            true,
            'foundation-v1',
            $issuedAt,
            $expiresAt,
            'primary',
            $signed,
        ));
        $this->assertFalse($signature->verify(
            'tenant-installation-1',
            'tenant.payments',
            true,
            'foundation-v1',
            $issuedAt,
            $expiresAt,
            'primary',
            $signed,
        ));
        $this->assertFalse($signature->verify(
            'another-installation',
            'tenant.foundation',
            true,
            'foundation-v1',
            $issuedAt,
            $expiresAt,
            'primary',
            $signed,
        ));
    }

    public function test_public_key_ring_supports_rotation_and_unknown_keys_fail_closed(): void
    {
        [$oldSeed, $oldPublicKey] = $this->keyMaterial("\x02");
        [$newSeed, $newPublicKey] = $this->keyMaterial("\x03");
        config([
            'tenant.entitlements.public_keys' => [
                'old' => base64_encode($oldPublicKey),
                'new' => base64_encode($newPublicKey),
            ],
            'tenant.entitlements.signing_key_id' => 'new',
            'tenant.entitlements.signing_seed' => base64_encode($newSeed),
        ]);
        $signature = app(TenantEntitlementSignature::class);
        $issuedAt = CarbonImmutable::parse('2026-08-02 10:00:00', 'UTC');
        $expiresAt = $issuedAt->addMonth();
        $signed = $signature->sign(
            'tenant-installation-1',
            'tenant.foundation',
            true,
            'foundation-v2',
            $issuedAt,
            $expiresAt,
        );

        $this->assertTrue($signature->verify(
            'tenant-installation-1',
            'tenant.foundation',
            true,
            'foundation-v2',
            $issuedAt,
            $expiresAt,
            'new',
            $signed,
        ));
        $this->assertFalse($signature->verify(
            'tenant-installation-1',
            'tenant.foundation',
            true,
            'foundation-v2',
            $issuedAt,
            $expiresAt,
            'missing',
            $signed,
        ));

        config([
            'tenant.entitlements.signing_key_id' => 'old',
            'tenant.entitlements.signing_seed' => base64_encode($oldSeed),
        ]);

        $this->assertNotSame($signed, $signature->sign(
            'tenant-installation-1',
            'tenant.foundation',
            true,
            'foundation-v2',
            $issuedAt,
            $expiresAt,
        ));
    }

    public function test_signing_seed_must_match_the_selected_public_key(): void
    {
        [$seed] = $this->keyMaterial("\x04");
        [, $differentPublicKey] = $this->keyMaterial("\x05");
        $this->configureKey('primary', $seed, $differentPublicKey);

        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('does not match');

        app(TenantEntitlementSignature::class)->sign(
            'tenant-installation-1',
            'tenant.foundation',
            true,
            'foundation-v1',
            CarbonImmutable::parse('2026-08-02 10:00:00', 'UTC'),
            CarbonImmutable::parse('2026-09-02 10:00:00', 'UTC'),
        );
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function keyMaterial(string $byte): array
    {
        $seed = str_repeat($byte, SODIUM_CRYPTO_SIGN_SEEDBYTES);
        $keyPair = sodium_crypto_sign_seed_keypair($seed);

        return [$seed, sodium_crypto_sign_publickey($keyPair)];
    }

    private function configureKey(string $keyId, string $seed, string $publicKey): void
    {
        config([
            'tenant.entitlements.public_keys' => [$keyId => base64_encode($publicKey)],
            'tenant.entitlements.signing_key_id' => $keyId,
            'tenant.entitlements.signing_seed' => base64_encode($seed),
        ]);
    }
}
