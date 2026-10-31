<?php

namespace App\Services;

use App\Models\MarketplaceHospital;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

final class HospitalAdministration
{
    public const FIELDS = ['name', 'slug', 'timezone', 'country_code', 'province', 'city', 'address', 'contact_phone', 'contact_email', 'website_url', 'profile', 'is_active'];

    public function actor(User $user, bool $lock = false): User
    {
        $fresh = User::with('roles')->when($lock, fn ($q) => $q->lockForUpdate())->findOrFail($user->id);
        abort_unless($fresh->permitsAuthentication() && $fresh->hasAnyRole(['admin', 'root-admin']), 403);

        return $fresh;
    }

    public function revision(User $actor, ?MarketplaceHospital $hospital): string
    {
        $state = [$actor->id, $actor->roles->pluck('name')->sort()->values()->all(), $hospital?->getAttributes(),
            $hospital ? null : [MarketplaceHospital::max('id'), MarketplaceHospital::count()],
            DB::table('audit_events')->whereIn('action', ['admin.hospital.created', 'admin.hospital.updated'])->max('id')];

        return hash_hmac('sha256', json_encode($state, JSON_THROW_ON_ERROR), (string) config('app.key'));
    }

    public function project(MarketplaceHospital $hospital): array
    {
        return ['public_id' => $hospital->public_id, ...$hospital->only(self::FIELDS), 'archived' => $hospital->archived_at !== null];
    }

    public function save(Request $request, ?MarketplaceHospital $hospital): MarketplaceHospital
    {
        $this->actor($request->user());
        abort_if(array_diff(array_keys($request->all()), [...self::FIELDS, 'reason', 'confirmed', 'expected_revision']), 422, 'Unsupported hospital fields.');
        $request->merge(['reason' => trim((string) $request->input('reason', ''))]);
        $data = $request->validate([
            'expected_revision' => ['required', 'regex:/\A[a-f0-9]{64}\z/'], 'confirmed' => ['required', 'accepted'], 'reason' => ['required', 'string', 'max:1000'],
            'name' => ['required', 'string', 'max:255'], 'slug' => ['required', 'string', 'max:190', 'regex:/\A[\pL\pN][\pL\pN_-]*\z/u'],
            'timezone' => ['required', 'timezone:all'], 'country_code' => ['nullable', 'regex:/\A[A-Z]{2}\z/'],
            'province' => ['nullable', 'string', 'max:120'], 'city' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:2000'], 'contact_phone' => ['nullable', 'string', 'max:30'],
            'contact_email' => ['nullable', 'email', 'max:255'], 'website_url' => ['nullable', 'url:http,https', 'max:2048'],
            'profile' => ['nullable', 'string', 'max:5000'], 'is_active' => ['required', 'boolean'],
        ]);

        return DB::transaction(function () use ($request, $hospital, $data): MarketplaceHospital {
            $actor = $this->actor($request->user(), true);
            $target = $hospital ? MarketplaceHospital::lockForUpdate()->findOrFail($hospital->id) : null;
            abort_if($target?->archived_at, 409, 'Archived hospital cannot be changed.');
            abort_unless(hash_equals($this->revision($actor, $target), $data['expected_revision']), 409, 'Hospital directory changed; refresh.');
            validator($data, ['slug' => [Rule::unique('marketplace_hospitals', 'slug')->ignore($target?->id)]])->validate();
            $before = $target?->only(self::FIELDS);
            $attributes = array_intersect_key($data, array_flip(self::FIELDS));
            $attributes = array_map(fn ($value) => is_string($value) ? trim($value) : $value, $attributes);
            if ($attributes['name'] === '') {
                throw ValidationException::withMessages(['name' => 'A name is required.']);
            }
            $target ??= new MarketplaceHospital;
            $target->fill(array_diff_key($attributes, ['is_active' => true]));
            $target->is_active = $attributes['is_active'];
            abort_if($target->exists && ! $target->isDirty(), 422, 'No hospital changes.');
            $creating = ! $target->exists;
            $target->save();
            app(AuditLogger::class)->log(request: $request, actor: $actor, action: $creating ? 'admin.hospital.created' : 'admin.hospital.updated', subject: $target, riskLevel: 'high', before: $before, after: ['public_id' => $target->public_id, 'is_active' => $target->is_active], reason: $data['reason']);

            return $target->fresh();
        }, 3);
    }
}
