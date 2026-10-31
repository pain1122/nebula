<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\ReservationMedicalRequest;
use App\Models\User;
use Closure;
use DomainException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class MedicalUploadAdmission
{
    public static function limits(): array
    {
        $rules = config('medical_uploads');
        $bounds = [
            'account_max_files' => [1, 10000],
            'account_max_bytes' => [1, 1099511627776],
            'request_max_files' => [1, 10000],
            'request_max_bytes' => [1, 1099511627776],
            'requests_per_user_per_minute' => [1, 1000],
            'requests_per_ip_per_minute' => [1, 10000],
            'concurrent_uploads' => [1, 16],
            'lease_seconds' => [30, 300],
        ];
        if (! is_array($rules) || count($rules) !== count($bounds) + 1) {
            throw new DomainException('Medical upload admission is unavailable.');
        }
        foreach ($bounds as $key => [$minimum, $maximum]) {
            $value = $rules[$key] ?? null;
            if (is_string($value) && preg_match('/^[1-9][0-9]*$/D', $value) && (string) (int) $value === $value) {
                $value = (int) $value;
            }
            if (! is_int($value) || $value < $minimum || $value > $maximum) {
                throw new DomainException('Medical upload admission is unavailable.');
            }
            $rules[$key] = $value;
        }
        $store = $rules['cache_store'] ?? null;
        if (! is_string($store) || ! preg_match('/^[a-z][a-z0-9_-]{0,40}$/D', $store)
            || ! in_array(config('cache.stores.'.$store.'.driver'), app()->environment('testing') ? ['database', 'redis', 'array'] : ['database', 'redis'], true)) {
            throw new DomainException('Medical upload admission is unavailable.');
        }

        return $rules;
    }

    /** One account writer and bounded shared slots around the transactional write.
     * Archived/expired rows still consume capacity until durable disposal exists.
     */
    public function within(Reservation $reservation, ?ReservationMedicalRequest $medicalRequest, int $bytes, Closure $write): mixed
    {
        $rules = self::limits();
        if ($bytes < 1) {
            throw new DomainException('Medical upload size is invalid.');
        }
        $ownerId = (int) Reservation::query()->whereKey($reservation->getKey())->value('user_id');
        if ($ownerId < 1 || $ownerId !== (int) $reservation->user_id) {
            throw new DomainException('Medical upload ownership changed.');
        }
        $locks = [];
        $deadline = hrtime(true) + $rules['lease_seconds'] * 1000000000;
        $expiresAt = now()->addSeconds($rules['lease_seconds']);
        try {
            $cache = $this->cacheOperation(fn () => Cache::store($rules['cache_store']));
            $account = $this->cacheOperation(fn () => $cache->lock('medical-upload:account:'.hash('sha256', (string) $ownerId), $rules['lease_seconds']));
            if (! $this->cacheOperation(fn () => $account->get())) {
                throw new ThrottleRequestsException('Medical upload capacity is busy.', null, ['Retry-After' => '5']);
            }
            $locks[] = $account;
            for ($slot = 0; $slot < $rules['concurrent_uploads']; $slot++) {
                $lock = $this->cacheOperation(fn () => $cache->lock('medical-upload:slot:'.$slot, $rules['lease_seconds']));
                if ($this->cacheOperation(fn () => $lock->get())) {
                    $locks[] = $lock;
                    break;
                }
            }
            if (count($locks) !== 2) {
                throw new ThrottleRequestsException('Medical upload capacity is busy.', null, ['Retry-After' => '5']);
            }

            return DB::transaction(function () use ($ownerId, $reservation, $medicalRequest, $bytes, $write, $rules, $locks, $deadline, $expiresAt) {
                // Existing account row serializes quota checks across all its reservations.
                User::query()->select('id')->lockForUpdate()->findOrFail($ownerId);
                $this->assertLease($rules, $locks, $deadline, $expiresAt);
                $this->assertQuota($ownerId, $medicalRequest?->getKey(), $bytes, $rules, adding: true);
                $result = $write();
                $this->assertLease($rules, $locks, $deadline, $expiresAt);
                $this->assertQuota($ownerId, $medicalRequest?->getKey(), 0, $rules, adding: false);
                if ((int) Reservation::query()->whereKey($reservation->getKey())->value('user_id') !== $ownerId) {
                    throw new DomainException('Medical upload ownership changed.');
                }

                return $result;
            });
        } finally {
            foreach (array_reverse($locks) as $lock) {
                try {
                    $lock->release(); // Owner-aware: never release a successor's lease.
                } catch (Throwable) {
                    // Do not turn an already committed upload into an apparent failure.
                    try {
                        report(new RuntimeException('Medical upload admission lease cleanup is unavailable.'));
                    } catch (Throwable) {
                        // Logging failure must not change the committed result either.
                    }
                }
            }
        }
    }

    private function assertLease(array $rules, array $locks, int $deadline, \DateTimeInterface $expiresAt): void
    {
        if ($rules !== self::limits() || hrtime(true) >= $deadline || now()->greaterThanOrEqualTo($expiresAt)) {
            throw new DomainException('Medical upload admission changed or expired. Retry the upload.');
        }
        foreach ($locks as $lock) {
            if (! $this->cacheOperation(fn () => $lock->isOwnedByCurrentProcess())) {
                throw new DomainException('Medical upload admission changed or expired. Retry the upload.');
            }
        }
    }

    private function cacheOperation(Closure $operation): mixed
    {
        try {
            return $operation();
        } catch (Throwable) {
            throw new DomainException('Medical upload admission is unavailable.');
        }
    }

    private function assertQuota(int $ownerId, ?int $requestId, int $bytes, array $rules, bool $adding): void
    {
        // Locking read avoids stale repeatable-read snapshots in an outer transaction.
        $files = DB::table('reservation_files')
            ->whereIn('reservation_id', DB::table('reservations')->select('id')->where('user_id', $ownerId))
            ->where('classification', 'medical')->where('disk', 'private')
            ->orderBy('id')->limit($rules['account_max_files'] + 1)->lockForUpdate()
            ->get(['size_bytes', 'medical_request_id']);
        $accountCount = $adding ? 1 : 0;
        $accountBytes = $bytes;
        $requestCount = $requestId !== null && $adding ? 1 : 0;
        $requestBytes = $requestId !== null ? $bytes : 0;
        foreach ($files as $file) {
            $size = filter_var($file->size_bytes, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0]]);
            if (! is_int($size) || $size > $rules['account_max_bytes'] - $accountBytes) {
                throw new DomainException('Medical upload allowance is exhausted.');
            }
            $accountCount++;
            $accountBytes += $size;
            if ($requestId !== null && (int) $file->medical_request_id === $requestId) {
                $requestCount++;
                if ($size > $rules['request_max_bytes'] - $requestBytes) {
                    throw new DomainException('Medical upload allowance is exhausted.');
                }
                $requestBytes += $size;
            }
        }
        if ($accountCount > $rules['account_max_files'] || $accountBytes > $rules['account_max_bytes']
            || ($requestId !== null && ($requestCount > $rules['request_max_files'] || $requestBytes > $rules['request_max_bytes']))) {
            throw new DomainException('Medical upload allowance is exhausted.');
        }
    }
}
