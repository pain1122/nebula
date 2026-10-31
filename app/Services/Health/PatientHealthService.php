<?php

namespace App\Services\Health;

use App\Models\PatientBiometricObservation;
use App\Models\PatientHealthSnapshot;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use UnexpectedValueException;

class PatientHealthService
{
    public function __construct(private readonly AuditLogger $audit) {}

    private function owner(User $actor): User
    {
        $owner = User::query()->lockForUpdate()->findOrFail($actor->id);
        $roles = $owner->roles()->lockForUpdate()->pluck('name')->all();
        // Mixed staff/clinical roles must not inherit a patient's private health surface.
        abort_unless($owner->permitsAuthentication() && $roles === ['patient'], 403);

        return $owner;
    }

    private function latest(User $owner): ?PatientHealthSnapshot
    {
        // A current locking read also avoids a pre-lock MySQL repeatable-read snapshot.
        return PatientHealthSnapshot::where('patient_id', $owner->id)->orderByDesc('version')->lockForUpdate()->first();
    }

    private function revision(User $owner, ?PatientHealthSnapshot $snapshot): string
    {
        return hash_hmac('sha256', json_encode([$owner->public_id, $owner->getRawOriginal('updated_at'), $snapshot?->public_id,
            $snapshot?->version, $snapshot ? hash('sha256', $snapshot->getRawOriginal('payload')) : null, HealthCatalog::VERSION], JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    private function payload(User $owner, ?PatientHealthSnapshot $snapshot): array
    {
        if (! $snapshot) {
            return ['owner_id' => $owner->public_id, 'version' => 0, 'facts' => [], 'observations' => []];
        }
        $payload = $snapshot->payload;
        if ($snapshot->schema_version !== 1 || $snapshot->catalog_version !== HealthCatalog::VERSION || ! is_array($payload)
            || ($payload['owner_id'] ?? null) !== $owner->public_id || ($payload['version'] ?? null) !== $snapshot->version
            || ! is_array($payload['facts'] ?? null) || ! is_array($payload['observations'] ?? null)) {
            throw new UnexpectedValueException('Health history is unavailable.');
        }

        return $payload;
    }

    private function observation(User $owner, PatientBiometricObservation $row): array
    {
        $payload = $row->payload;
        if ($row->patient_id !== $owner->id || $row->schema_version !== 1 || $row->source !== 'self_report'
            || ! in_array($row->metric, ['weight', 'height'], true) || ! is_array($payload)
            || ($payload['owner_id'] ?? null) !== $owner->public_id || ($payload['metric'] ?? null) !== $row->metric
            || ($payload['public_id'] ?? null) !== $row->public_id || ! is_int($payload['hundredths'] ?? null)) {
            throw new UnexpectedValueException('Health observation is unavailable.');
        }
        $value = intdiv($payload['hundredths'], 100).'.'.str_pad((string) ($payload['hundredths'] % 100), 2, '0', STR_PAD_LEFT);

        return ['id' => $row->public_id, 'metric' => $row->metric, 'value' => $value, 'unit' => $payload['unit'], 'measured_on' => $payload['measured_on'],
            'recorded_at' => $row->recorded_at->toIso8601String(), 'source' => 'self_report'];
    }

    private function present(User $owner, ?PatientHealthSnapshot $snapshot): array
    {
        $payload = $this->payload($owner, $snapshot);
        $measurements = [];
        foreach ($payload['observations'] as $metric => $id) {
            if ($id === null) {
                continue;
            }
            $row = PatientBiometricObservation::where('patient_id', $owner->id)->where('metric', $metric)->where('public_id', $id)->first();
            if (! $row) {
                throw new UnexpectedValueException('Health observation reference is unavailable.');
            }
            $measurements[$metric] = $this->observation($owner, $row);
        }
        $facts = array_map(fn ($fact) => $fact['value'], $payload['facts']);
        $birth = $facts['birth_date'] ?? null;
        $age = $birth ? (int) (new \DateTimeImmutable($birth))->diff(new \DateTimeImmutable(now('Asia/Tehran')->toDateString()))->y : null;
        $weight = $measurements['weight'] ?? null;
        $height = $measurements['height'] ?? null;
        $bmi = $weight && $height ? round((float) $weight['value'] / (((float) $height['value'] / 100) ** 2), 2) : null;
        $history = [];
        $truncated = [];
        foreach (['weight', 'height'] as $metric) {
            $rows = PatientBiometricObservation::where('patient_id', $owner->id)->where('metric', $metric)->orderByDesc('id')->limit(21)->get();
            $truncated[$metric] = $rows->count() > 20;
            $history[$metric] = $rows->take(20)->map(fn ($row) => $this->observation($owner, $row))->all();
        }

        return ['owner_id' => $owner->public_id, 'revision' => $this->revision($owner, $snapshot), 'schema_version' => 1,
            'version' => $snapshot?->version ?? 0, 'recorded_at' => $snapshot?->recorded_at->toIso8601String(), 'catalog' => HealthCatalog::response(),
            'facts' => (object) $facts, 'provenance' => (object) $payload['facts'], 'measurements' => (object) $measurements,
            'age' => $age, 'bmi' => $bmi, 'history' => $history, 'history_truncated' => $truncated];
    }

    public function read(User $actor): array
    {
        return DB::transaction(function () use ($actor) {
            $owner = $this->owner($actor);

            return $this->present($owner, $this->latest($owner));
        });
    }

    public function save(Request $request, User $actor, array $data): array
    {
        HealthInput::keys($data, ['expected_revision', 'catalog_version', 'confirmed', 'changes', 'measurements']);
        if (($data['confirmed'] ?? null) !== true || ($data['catalog_version'] ?? null) !== HealthCatalog::VERSION
            || ! is_string($data['expected_revision'] ?? null) || ! preg_match('/\A[a-f0-9]{64}\z/', $data['expected_revision'])
            || ! is_array($data['changes'] ?? null) || ! is_array($data['measurements'] ?? null)) {
            HealthInput::fail();
        }
        $changes = HealthInput::facts($data['changes']);
        $measurements = HealthInput::measurements($data['measurements']);

        return DB::transaction(function () use ($request, $actor, $data, $changes, $measurements) {
            $owner = $this->owner($actor);
            $previous = $this->latest($owner);
            abort_unless(hash_equals($this->revision($owner, $previous), $data['expected_revision']), 409);
            $payload = $this->payload($owner, $previous);
            $count = 0;
            $observationCount = 0;
            $recorded = now();
            foreach ($changes as $code => $value) {
                if (($payload['facts'][$code]['value'] ?? null) === $value) {
                    continue;
                }
                $payload['facts'][$code] = ['value' => $value, 'source' => 'self_report', 'asserted_at' => $recorded->toIso8601String()];
                $count++;
            }
            foreach ($measurements as $metric => $input) {
                $selected = $payload['observations'][$metric] ?? null;
                if ($input === null) {
                    if ($selected !== null) {
                        $payload['observations'][$metric] = null;
                        $count++;
                    }

                    continue;
                }
                $corrects = null;
                if ($input['correction_of'] !== null) {
                    $corrects = PatientBiometricObservation::where('patient_id', $owner->id)->where('metric', $metric)->where('public_id', $input['correction_of'])->first();
                    if (! $corrects || $corrects->public_id !== $selected) {
                        HealthInput::fail();
                    }
                }
                $canonical = array_diff_key($input, ['correction_of' => true]);
                if ($selected) {
                    $old = PatientBiometricObservation::where('patient_id', $owner->id)->where('metric', $metric)->where('public_id', $selected)->firstOrFail();
                    $this->observation($owner, $old);
                    if (array_intersect_key($old->payload, $canonical) === $canonical) {
                        continue;
                    }
                }
                $observation = new PatientBiometricObservation(['patient_id' => $owner->id, 'actor_id' => $owner->id,
                    'metric' => $metric, 'source' => 'self_report', 'schema_version' => 1, 'corrects_id' => $corrects?->id, 'recorded_at' => $recorded]);
                $observation->public_id = strtolower((string) \Illuminate\Support\Str::ulid());
                $observation->payload = [...$canonical, 'owner_id' => $owner->public_id, 'metric' => $metric, 'public_id' => $observation->public_id];
                $observation->save();
                $payload['observations'][$metric] = $observation->public_id;
                $observationCount++;
                $count++;
            }
            if ($count === 0) {
                HealthInput::fail();
            }
            $payload['version']++;
            $snapshot = PatientHealthSnapshot::create(['patient_id' => $owner->id, 'actor_id' => $owner->id, 'version' => $payload['version'],
                'schema_version' => 1, 'catalog_version' => HealthCatalog::VERSION, 'payload' => $payload, 'recorded_at' => $recorded]);
            $this->audit->log($request, $owner, 'patient.health.updated', $owner, 'high', null,
                ['snapshot_id' => $snapshot->public_id, 'version' => $snapshot->version, 'schema_version' => 1, 'changed_count' => $count, 'observation_count' => $observationCount]);

            return $this->present($owner, $snapshot);
        });
    }
}
