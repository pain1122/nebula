<?php

namespace App\Support;

use Carbon\CarbonInterface;
use JsonException;
use LogicException;

final class TenantEntitlementSignature
{
    public const ALGORITHM = 'ed25519';

    public function sign(
        string $installationKey,
        string $featureKey,
        bool $enabled,
        string $entitlementVersion,
        CarbonInterface $issuedAt,
        CarbonInterface $expiresAt,
        ?string $keyId = null,
    ): string {
        $this->assertSodiumIsAvailable();

        $resolvedKeyId = $keyId ?? (string) config('tenant.entitlements.signing_key_id');
        $seed = $this->decodeConfiguredKey(
            config('tenant.entitlements.signing_seed'),
            SODIUM_CRYPTO_SIGN_SEEDBYTES,
            'Tenant entitlement signing seed',
        );
        $configuredPublicKey = $this->publicKey($resolvedKeyId);
        $keyPair = sodium_crypto_sign_seed_keypair($seed);
        $derivedPublicKey = sodium_crypto_sign_publickey($keyPair);

        if (! hash_equals($configuredPublicKey, $derivedPublicKey)) {
            throw new LogicException('Tenant entitlement signing seed does not match the configured public key.');
        }

        $payload = $this->canonicalPayload(
            $installationKey,
            $featureKey,
            $enabled,
            $entitlementVersion,
            $issuedAt,
            $expiresAt,
            $resolvedKeyId,
        );

        return base64_encode(sodium_crypto_sign_detached(
            $payload,
            sodium_crypto_sign_secretkey($keyPair),
        ));
    }

    public function verify(
        string $installationKey,
        string $featureKey,
        bool $enabled,
        string $entitlementVersion,
        CarbonInterface $issuedAt,
        CarbonInterface $expiresAt,
        string $keyId,
        string $signature,
    ): bool {
        if (! $this->sodiumIsAvailable()) {
            return false;
        }

        try {
            $publicKey = $this->publicKey($keyId);
            $decodedSignature = $this->decodeConfiguredKey(
                $signature,
                SODIUM_CRYPTO_SIGN_BYTES,
                'Tenant entitlement signature',
            );
            $payload = $this->canonicalPayload(
                $installationKey,
                $featureKey,
                $enabled,
                $entitlementVersion,
                $issuedAt,
                $expiresAt,
                $keyId,
            );
        } catch (JsonException|LogicException) {
            return false;
        }

        return sodium_crypto_sign_verify_detached($decodedSignature, $payload, $publicKey);
    }

    /**
     * @throws JsonException
     */
    public function canonicalPayload(
        string $installationKey,
        string $featureKey,
        bool $enabled,
        string $entitlementVersion,
        CarbonInterface $issuedAt,
        CarbonInterface $expiresAt,
        string $keyId,
    ): string {
        return json_encode([
            'schema' => 'checkupino-tenant-entitlement-v1',
            'tenant_installation_key' => $installationKey,
            'feature_key' => $featureKey,
            'enabled' => $enabled,
            'entitlement_version' => $entitlementVersion,
            'issued_at' => $issuedAt->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
            'expires_at' => $expiresAt->copy()->utc()->format('Y-m-d\TH:i:s\Z'),
            'signature_algorithm' => self::ALGORITHM,
            'signing_key_id' => $keyId,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    private function publicKey(string $keyId): string
    {
        if ($keyId === '') {
            throw new LogicException('Tenant entitlement signing key ID is required.');
        }

        $keys = config('tenant.entitlements.public_keys', []);

        if (! is_array($keys) || ! array_key_exists($keyId, $keys)) {
            throw new LogicException("Unknown tenant entitlement signing key ID [{$keyId}].");
        }

        return $this->decodeConfiguredKey(
            $keys[$keyId],
            SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES,
            "Tenant entitlement public key [{$keyId}]",
        );
    }

    private function decodeConfiguredKey(mixed $encoded, int $expectedLength, string $label): string
    {
        if (! is_string($encoded) || $encoded === '') {
            throw new LogicException("{$label} is not configured.");
        }

        $decoded = base64_decode($encoded, true);

        if ($decoded === false || strlen($decoded) !== $expectedLength) {
            throw new LogicException("{$label} must be valid base64 with {$expectedLength} decoded bytes.");
        }

        return $decoded;
    }

    private function assertSodiumIsAvailable(): void
    {
        if (! $this->sodiumIsAvailable()) {
            throw new LogicException('The sodium extension is required for tenant entitlement signing.');
        }
    }

    private function sodiumIsAvailable(): bool
    {
        return function_exists('sodium_crypto_sign_detached')
            && function_exists('sodium_crypto_sign_verify_detached');
    }
}
