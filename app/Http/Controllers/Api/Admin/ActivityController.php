<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Models\AuditEvent;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** Operational audit metadata only. Raw audit payloads are never a read resource. */
class ActivityController extends ApiController
{
    private const ACTIONS = [
        'profile.display_name.updated' => 'account',
        'admin.profile.display_name.updated' => 'account',
        'admin.user.created' => 'account',
        'admin.user.updated' => 'account',
        'admin.user.account_state.changed' => 'account',
        'admin.doctor.verification_changed' => 'doctor',
        'reservation.cancelled' => 'reservation',
        'reservation.completed' => 'reservation',
        'reservation.rescheduled' => 'reservation',
        'admin.reservation.status_overridden' => 'reservation',
        'doctor.visit_slots.controlled' => 'schedule',
        'admin.visit_slots.controlled' => 'schedule',
        'admin.payment.adjustment_requested' => 'payment',
        'admin.questionnaire.created' => 'questionnaire',
        'admin.questionnaire.updated' => 'questionnaire',
        'admin.questionnaire.archived' => 'questionnaire',
        'admin.questionnaire_submission.archived' => 'questionnaire',
        'admin.rating_option.created' => 'catalog',
        'admin.rating_option.updated' => 'catalog',
        'admin.rating_option.archived' => 'catalog',
        'admin.checkup.created' => 'catalog',
        'admin.checkup.updated' => 'catalog',
        'admin.checkup.archived' => 'catalog',
        'admin.checkup.category_detached' => 'catalog',
        'admin.checkup.category_reassigned' => 'catalog',
        'admin.checkup_category.archived' => 'catalog',
        'admin.checkup_category.created' => 'catalog',
        'admin.checkup_category.updated' => 'catalog',
        'admin.specialty.created' => 'catalog',
        'admin.specialty.updated' => 'catalog',
        'admin.specialty.archived' => 'catalog',
        'settings.marketplace.updated' => 'settings',
        'reservation_file.uploaded' => 'medical',
        'reservation_file.scan_recorded' => 'medical',
        'reservation_file.accessed' => 'medical',
        'reservation_file.archived' => 'medical',
        'reservation_medical_file.uploaded' => 'medical',
        'reservation_medical_file.scan_recorded' => 'medical',
        'reservation_medical_file.accessed' => 'medical',
        'reservation_medical_file.archived' => 'medical',
        'reservation_medical_request.created' => 'medical',
        'reservation_medical_request.review_started' => 'medical',
        'reservation_report.draft_saved' => 'medical',
        'reservation_report.published' => 'medical',
        'admin.medical_request.created' => 'medical',
        'admin.medical_request.review_started' => 'medical',
        'admin.medical_report.draft_saved' => 'medical',
        'admin.medical_report.published' => 'medical',
    ];

    public function index(Request $request)
    {
        $actor = User::with('roles')->findOrFail($request->user()->id);
        abort_unless($actor->permitsAuthentication() && $actor->canAccessAdminPanel(), 403);
        $keys = ['q', 'actor_id', 'actor_role', 'category', 'action', 'subject_public_id', 'risk', 'from', 'to', 'page', 'per_page', 'sort_dir'];
        if (array_diff(array_keys($request->query()), $keys)) {
            throw ValidationException::withMessages(['filters' => 'Unsupported activity filter.']);
        }
        $data = $request->validate([
            'q' => ['nullable', 'string', 'ulid'],
            'actor_id' => ['nullable', 'integer', 'min:1'],
            'actor_role' => ['nullable', Rule::in(['patient', 'doctor', 'admin', 'root-admin'])],
            'category' => ['nullable', Rule::in(array_values(array_unique(self::ACTIONS)))],
            'action' => ['nullable', Rule::in(array_keys(self::ACTIONS))],
            'subject_public_id' => ['nullable', 'string', 'ulid'],
            'risk' => ['nullable', Rule::in(['low', 'medium', 'high', 'critical'])],
            'from' => ['nullable', 'required_with:to', 'date_format:Y-m-d'],
            'to' => ['nullable', 'required_with:from', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort_dir' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);
        abort_if(! $actor->isRootAdmin() && ($data['actor_role'] ?? null) === 'root-admin', 403);
        if (! $actor->isRootAdmin() && isset($data['actor_id'])) {
            $selected = User::with('roles')->find($data['actor_id']);
            abort_if($selected && ! $selected->is($actor) && $selected->hasAnyRole(['admin', 'root-admin']), 403);
        }
        $today = CarbonImmutable::now('Asia/Tehran')->startOfDay();
        $from = isset($data['from']) ? CarbonImmutable::createFromFormat('!Y-m-d', $data['from'], 'Asia/Tehran') : $today->subDays(29);
        $to = isset($data['to']) ? CarbonImmutable::createFromFormat('!Y-m-d', $data['to'], 'Asia/Tehran') : $today;
        if ($to->lessThan($from) || $to->greaterThan($from->addDays(89))) {
            throw ValidationException::withMessages(['to' => 'Choose an ordered period of at most 90 inclusive days.']);
        }
        $query = AuditEvent::query()
            ->select(['id', 'public_id', 'actor_user_id', 'action', 'subject_type', 'subject_id', 'subject_public_id', 'risk_level', 'outcome', 'created_at'])
            ->selectRaw("CASE WHEN reason IS NOT NULL AND TRIM(reason) <> '' THEN 1 ELSE 0 END AS reason_recorded")
            ->with(['actor' => fn ($user) => $user->select(['id', 'public_id', 'name'])->with('roles:id,name')])
            ->whereIn('action', array_keys(self::ACTIONS))
            ->whereIn('risk_level', ['low', 'medium', 'high', 'critical'])
            ->whereIn('outcome', ['succeeded', 'failed', 'denied'])
            ->where('created_at', '>=', $from->utc())
            ->where('created_at', '<', $to->addDay()->utc());
        $query->where(function (Builder $known): void {
            $types = [];
            foreach (array_keys(self::ACTIONS) as $action) {
                $types[self::subjectType($action)][] = $action;
            }
            foreach ($types as $type => $actions) {
                $known->orWhere(fn (Builder $pair) => $pair->where('subject_type', $type)->whereIn('action', $actions));
            }
        });
        if (! $actor->isRootAdmin()) {
            $query->where(function (Builder $visible) use ($actor): void {
                $visible->where('subject_type', '!=', User::class)
                    ->orWhere('subject_id', $actor->id)
                    ->orWhereIn('subject_id', User::query()->select('id')->whereDoesntHave('roles', fn ($role) => $role->whereIn('name', ['admin', 'root-admin'])));
            });
        } else {
            // Root identities stay private even to another root; own activity is available.
            $query->where(function (Builder $visible) use ($actor): void {
                $visible->where('subject_type', '!=', User::class)->orWhere('subject_id', $actor->id)
                    ->orWhereIn('subject_id', User::query()->select('id')->whereDoesntHave('roles', fn ($role) => $role->where('name', 'root-admin')));
            });
        }
        foreach (['action' => 'action', 'risk' => 'risk_level', 'subject_public_id' => 'subject_public_id'] as $key => $column) {
            if (isset($data[$key])) {
                $query->where($column, $data[$key]);
            }
        }
        if (isset($data['q'])) {
            $query->where(fn (Builder $search) => $search->where('public_id', $data['q'])->orWhere('subject_public_id', $data['q']));
        }
        if (isset($data['category'])) {
            $query->whereIn('action', array_keys(array_filter(self::ACTIONS, fn ($category) => $category === $data['category'])));
        }
        if (isset($data['actor_id'])) {
            $query->where('actor_user_id', $data['actor_id']);
        }
        if (isset($data['actor_role'])) {
            $query->whereHas('actor.roles', fn ($role) => $role->where('name', $data['actor_role']));
            if (! $actor->isRootAdmin()) {
                $query->where(fn (Builder $visible) => $visible->where('actor_user_id', $actor->id)
                    ->orWhereHas('actor', fn ($user) => $user->whereDoesntHave('roles', fn ($role) => $role->whereIn('name', ['admin', 'root-admin']))));
            }
        }
        $direction = $data['sort_dir'] ?? 'desc';
        $rows = $query->orderBy('created_at', $direction)->orderBy('id', $direction)->paginate($data['per_page'] ?? 20);
        $items = $rows->getCollection()->map(function (AuditEvent $row) use ($actor): array {
            $author = $row->actor;
            $hidden = ! $author || ($author->isRootAdmin() && ! $author->is($actor))
                || (! $actor->isRootAdmin() && ! $author->is($actor) && $author->hasRole('admin'));

            return [
                'public_id' => (string) $row->public_id,
                'action' => $row->action, 'category' => self::ACTIONS[$row->action],
                'actor' => ['public_id' => $hidden ? null : (string) $author->public_id,
                    'name' => $hidden ? null : $author->name, 'role' => $hidden ? null : $author->roles->pluck('name')->first(),
                    'identity_available' => ! $hidden],
                'subject_public_id' => $row->subject_public_id,
                'risk' => $row->risk_level, 'outcome' => $row->outcome,
                'reason_recorded' => (bool) $row->reason_recorded,
                'created_at' => $row->created_at?->toISOString(),
            ];
        })->all();
        $current = User::with('roles')->find($actor->id);
        abort_unless($current?->permitsAuthentication()
            && $current->roles->pluck('name')->sort()->values()->all() === $actor->roles->pluck('name')->sort()->values()->all(), 403);

        return $this->successResponse(data: $items, meta: [
            'pagination' => ['current_page' => $rows->currentPage(), 'last_page' => $rows->lastPage(), 'per_page' => $rows->perPage(), 'total' => $rows->total()],
            'period' => ['from' => $from->toDateString(), 'to' => $to->toDateString(), 'timezone' => 'Asia/Tehran'],
            'generated_at' => now()->toISOString(),
        ])->header('Cache-Control', 'no-store, private');
    }

    private static function subjectType(string $action): string
    {
        return match (true) {
            str_contains($action, 'profile.display_name'), str_starts_with($action, 'admin.user.') => User::class,
            str_starts_with($action, 'admin.doctor.') => \App\Models\DoctorProfile::class,
            str_starts_with($action, 'doctor.visit_slots.'), str_starts_with($action, 'admin.visit_slots.') => \App\Models\DoctorWorkplace::class,
            str_starts_with($action, 'admin.payment.') => \App\Models\PaymentAdjustment::class,
            str_starts_with($action, 'admin.questionnaire_submission.') => \App\Models\QuestionnaireSubmission::class,
            str_starts_with($action, 'admin.questionnaire.') => \App\Models\Questionnaire::class,
            str_starts_with($action, 'admin.rating_option.') => \App\Models\ReservationRatingOption::class,
            str_starts_with($action, 'admin.checkup_category.') => \App\Models\CheckupCategory::class,
            str_starts_with($action, 'admin.specialty.') => \App\Models\Specialty::class,
            str_starts_with($action, 'admin.checkup.') => \App\Models\Checkup::class,
            str_starts_with($action, 'settings.marketplace.') => \App\Models\SettingValue::class,
            str_starts_with($action, 'reservation_file.'), str_starts_with($action, 'reservation_medical_file.') => \App\Models\ReservationFile::class,
            str_starts_with($action, 'reservation_medical_request.'), str_starts_with($action, 'admin.medical_request.') => \App\Models\ReservationMedicalRequest::class,
            str_starts_with($action, 'reservation_report.'), str_starts_with($action, 'admin.medical_report.') => \App\Models\ReservationReport::class,
            default => \App\Models\Reservation::class,
        };
    }
}
