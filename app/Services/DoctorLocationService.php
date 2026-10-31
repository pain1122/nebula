<?php

namespace App\Services;

use App\Models\Checkup;
use App\Models\DoctorProfile;
use App\Models\DoctorWorkplace;
use App\Models\MarketplaceHospital;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class DoctorLocationService
{
    public function hospitalRevision(MarketplaceHospital $hospital): string
    {
        return hash_hmac('sha256', json_encode($hospital->getAttributes(), JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    public function options(Request $request): array
    {
        $practice = app(DoctorPracticeService::class);
        $actor = $practice->actor($request->user());
        abort_if(array_diff(array_keys($request->query()), ['q', 'page']), 422);
        $data = $request->validate(['q' => ['nullable', 'string', 'max:160'], 'page' => ['nullable', 'integer', 'between:1,1000']]);
        $hospitals = MarketplaceHospital::where('is_active', true)->whereNull('archived_at')
            ->whereDoesntHave('workplaces', fn ($q) => $q->where('doctor_profile_id', $actor->doctorProfile->id))
            ->when($data['q'] ?? null, fn ($q, $term) => $q->where(fn ($q) => $q->where('name', 'like', '%'.$term.'%')->orWhere('city', 'like', '%'.$term.'%')))
            ->orderBy('name')->orderBy('id')->paginate(20);
        $services = Checkup::where('is_active', true)->whereHas('category', fn ($q) => $q->where('is_active', true))->orderBy('title')->orderBy('id')->limit(501)->get();
        abort_if($services->count() > 500, 422, 'Service catalog requires bounded search before further expansion.');
        $capture = $practice->capture($actor);

        return ['owner_id' => $actor->id, 'revision' => $capture['revision'], 'default_price' => $capture['professional']['fee'],
            'hospitals' => $hospitals->map(fn ($h) => ['public_id' => $h->public_id, 'name' => $h->name, 'city' => $h->city, 'address' => $h->address, 'timezone' => $h->timezone, 'revision' => $this->hospitalRevision($h)])->all(),
            'page' => $hospitals->currentPage(), 'last_page' => $hospitals->lastPage(),
            'services' => $services->map(fn ($c) => ['id' => $c->id, 'title' => $c->title, 'currency' => $c->currency])->all()];
    }

    public function attach(Request $request): array
    {
        $practice = app(DoctorPracticeService::class);
        $actor = $practice->actor($request->user());
        abort_if(array_diff(array_keys($request->all()), ['hospital_public_id', 'hospital_revision', 'expected_revision', 'services', 'reason', 'confirmed']), 422);
        $request->merge(['reason' => trim((string) $request->input('reason', ''))]);
        $data = $request->validate([
            'hospital_public_id' => ['required', 'ulid'], 'hospital_revision' => ['required', 'regex:/\A[a-f0-9]{64}\z/'],
            'expected_revision' => ['required', 'regex:/\A[a-f0-9]{64}\z/'], 'reason' => ['required', 'string', 'max:1000'], 'confirmed' => ['required', 'accepted'],
            'services' => ['required', 'array', 'min:1', 'max:30'], 'services.*' => ['array:id,price,currency'],
            'services.*.id' => ['required', 'integer', 'distinct', 'min:1'], 'services.*.price' => ['required', 'integer', 'between:0,2147483647'],
            'services.*.currency' => ['required', 'regex:/\A[A-Z]{3}\z/'],
        ]);

        return DB::transaction(function () use ($request, $practice, $actor, $data): array {
            $lockedActor = \App\Models\User::with('roles')->lockForUpdate()->findOrFail($actor->id);
            $lockedActor = $practice->actor($lockedActor);
            $profile = DoctorProfile::lockForUpdate()->findOrFail($lockedActor->doctorProfile->id);
            abort_unless(hash_equals($practice->capture($lockedActor)['revision'], $data['expected_revision']), 409, 'Practice changed; refresh.');
            $hospital = MarketplaceHospital::where('public_id', $data['hospital_public_id'])->lockForUpdate()->firstOrFail();
            abort_unless($hospital->is_active && ! $hospital->archived_at, 422, 'Hospital unavailable.');
            abort_unless(hash_equals($this->hospitalRevision($hospital), $data['hospital_revision']), 409, 'Hospital changed; refresh.');
            abort_if($profile->workplaces()->where('marketplace_hospital_id', $hospital->id)->exists(), 409, 'Hospital already selected.');
            $ids = array_column($data['services'], 'id');
            $services = Checkup::whereIn('id', $ids)->where('is_active', true)->whereHas('category', fn ($q) => $q->where('is_active', true))->orderBy('id')->lockForUpdate()->get();
            abort_unless($services->count() === count($ids), 422, 'Service unavailable.');
            $workplace = DoctorWorkplace::create(['doctor_profile_id' => $profile->id, 'marketplace_hospital_id' => $hospital->id]);
            $workplace->checkups()->attach(collect($data['services'])->mapWithKeys(fn ($s) => [$s['id'] => ['price_override' => $s['price'], 'currency_override' => $s['currency'], 'is_active' => true]])->all());
            app(AuditLogger::class)->log(request: $request, actor: $lockedActor, action: 'doctor.location.added', subject: $profile, riskLevel: 'high', before: null, after: ['workplace_id' => $workplace->id, 'hospital_public_id' => $hospital->public_id, 'services' => $data['services']], reason: $data['reason']);

            return $practice->capture($lockedActor);
        }, 3);
    }

    public function prices(Request $request, DoctorWorkplace $workplace): array
    {
        $practice = app(DoctorPracticeService::class);
        $actor = $practice->actor($request->user());
        abort_unless($workplace->doctor_profile_id === $actor->doctorProfile->id, 404);
        abort_if(array_diff(array_keys($request->all()), ['expected_revision', 'services', 'reason', 'confirmed']), 422);
        $request->merge(['reason' => trim((string) $request->input('reason', ''))]);
        $data = $request->validate([
            'expected_revision' => ['required', 'regex:/\A[a-f0-9]{64}\z/'], 'reason' => ['required', 'string', 'max:1000'], 'confirmed' => ['required', 'accepted'],
            'services' => ['required', 'array', 'min:1', 'max:30'], 'services.*' => ['array:id,price,currency'],
            'services.*.id' => ['required', 'integer', 'distinct', 'min:1'], 'services.*.price' => ['required', 'integer', 'between:0,2147483647'],
            'services.*.currency' => ['required', 'regex:/\A[A-Z]{3}\z/'],
        ]);

        return DB::transaction(function () use ($request, $practice, $actor, $workplace, $data): array {
            $locked = \App\Models\User::lockForUpdate()->findOrFail($actor->id);
            $locked = $practice->actor($locked);
            $profile = DoctorProfile::lockForUpdate()->findOrFail($locked->doctorProfile->id);
            $target = $profile->workplaces()->lockForUpdate()->findOrFail($workplace->id);
            $hospital = $target->hospital()->lockForUpdate()->firstOrFail();
            abort_unless($target->is_active && ! $target->archived_at && $hospital->is_active && ! $hospital->archived_at, 422);
            abort_unless(hash_equals($practice->capture($locked)['revision'], $data['expected_revision']), 409);
            $ids = array_column($data['services'], 'id');
            $services = Checkup::whereIn('id', $ids)->where('is_active', true)->whereHas('category', fn ($q) => $q->where('is_active', true))->orderBy('id')->lockForUpdate()->get();
            abort_unless($services->count() === count($ids), 422);
            // Updating defaults never rewrites slots or removes existing offerings/history.
            $existing = $target->checkups()->whereIn('checkups.id', $ids)->get()->keyBy('id');
            $changed = collect($data['services'])->contains(function ($service) use ($existing): bool {
                $current = $existing->get($service['id']);

                return ! $current || ! $current->pivot->is_active || $current->pivot->price_override === null
                    || (int) $current->pivot->price_override !== (int) $service['price'] || $current->pivot->currency_override !== $service['currency'];
            });
            abort_unless($changed, 422, 'No service price changes.');
            $target->checkups()->syncWithoutDetaching(collect($data['services'])->mapWithKeys(fn ($s) => [$s['id'] => ['price_override' => $s['price'], 'currency_override' => $s['currency'], 'is_active' => true]])->all());
            app(AuditLogger::class)->log(request: $request, actor: $locked, action: 'doctor.location.prices.updated', subject: $profile, riskLevel: 'high',
                before: ['workplace_id' => $target->id, 'services' => $existing->map(fn ($s) => ['id' => $s->id, 'price' => $s->pivot->price_override === null ? null : (int) $s->pivot->price_override, 'currency' => $s->pivot->currency_override])->values()->all()],
                after: ['workplace_id' => $target->id, 'services' => $data['services']], reason: $data['reason']);

            return $practice->capture($locked);
        }, 3);
    }
}
