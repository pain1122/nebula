<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ReservationMedicalRequestStatus;
use App\Http\Controllers\Api\ApiController;
use App\Http\Resources\AdminMedicalRequestResource;
use App\Http\Resources\ReservationMedicalFileResource;
use App\Http\Resources\ReservationReportResource;
use App\Models\Reservation;
use App\Models\ReservationFile;
use App\Models\ReservationMedicalRequest;
use App\Models\ReservationReport;
use App\Services\ReservationFileService;
use App\Services\ReservationMedicalRequestService;
use App\Services\ReservationReportService;
use App\Support\AdminPanelFilters;
use App\Support\QuerySorting;
use DomainException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class MedicalRequestController extends ApiController
{
    private function query()
    {
        return ReservationMedicalRequest::query()->whereHas('reservation')
            ->with(['reservation.user:id,name', 'reservation.doctor.user:id,name', 'requester:id,name'])
            ->withCount([
                'files',
                'files as awaiting_checks_count' => fn ($q) => $q->where('scan_status', 'quarantined'),
                'files as eligible_count' => fn ($q) => $q->availableForMedicalReview(),
                'reports as published_count' => fn ($q) => $q->where('status', 'published'),
            ]);
    }

    public function index(Request $request)
    {
        $filters = AdminPanelFilters::validate($request, [
            'doctor_id' => ['nullable', 'integer', 'min:1'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'reservation_id' => ['nullable', 'integer', 'min:1'],
            'status' => ['nullable', Rule::enum(ReservationMedicalRequestStatus::class)],
            'stage' => ['nullable', Rule::in(['awaiting_upload', 'awaiting_checks', 'ready', 'in_review', 'published', 'attention'])],
        ]);
        $query = $this->query();
        foreach (['doctor_id' => 'doctor_profile_id', 'user_id' => 'user_id'] as $filter => $column) {
            if (! empty($filters[$filter])) {
                $query->whereHas('reservation', fn ($q) => $q->where($column, $filters[$filter]));
            }
        }
        if (! empty($filters['reservation_id'])) {
            $query->where('reservation_id', $filters['reservation_id']);
        }
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['q'])) {
            $term = trim($filters['q']);
            $query->where(function ($q) use ($term): void {
                $q->where('public_id', $term)->orWhere('title', 'like', "%{$term}%")
                    ->orWhereHas('reservation.user', fn ($u) => $u->where('name', 'like', "%{$term}%"))
                    ->orWhereHas('reservation.doctor.user', fn ($u) => $u->where('name', 'like', "%{$term}%"));
            });
        }
        $stage = $filters['stage'] ?? null;
        if ($stage === 'awaiting_upload') {
            $query->where('status', 'open')->whereDoesntHave('files');
        } elseif ($stage === 'awaiting_checks') {
            $query->where('status', 'open')->whereHas('files', fn ($q) => $q->where('scan_status', 'quarantined'));
        } elseif ($stage === 'ready') {
            $query->where('status', 'open')->where(function ($q): void {
                $q->whereNull('retention_until')->orWhere('retention_until', '>', now());
            })->whereHas('files', fn ($q) => $q->availableForMedicalReview());
        } elseif ($stage === 'in_review') {
            $query->where('status', 'in_review');
        } elseif ($stage === 'published') {
            $query->whereHas('reports', fn ($q) => $q->where('status', 'published'));
        } elseif ($stage === 'attention') {
            $query->where(function ($q): void {
                $q->where('retention_until', '<=', now())
                    ->orWhereHas('files', fn ($files) => $files->whereIn('scan_status', ['infected', 'failed']));
            });
        }
        AdminPanelFilters::dates($query, $filters);
        QuerySorting::apply($query, $request, ['created_at' => 'created_at', 'title' => 'title', 'status' => 'status'], 'created_at', 'desc');
        $page = $query->orderByDesc('id')->paginate(min(100, $filters['per_page'] ?? 20));

        return $this->successResponse(
            data: AdminMedicalRequestResource::collection($page->getCollection())->resolve($request),
            meta: AdminPanelFilters::pagination($page),
        )->header('Cache-Control', 'private, no-store');
    }

    public function show(Request $request, ReservationMedicalRequest $medicalRequest)
    {
        $row = $this->query()->findOrFail($medicalRequest->id);
        $retained = $row->retention_until === null || $row->retention_until->isFuture();
        $files = $retained ? $row->files()->availableForMedicalReview()->orderBy('id')->limit(101)->get() : collect();
        $reports = $retained ? $row->reports()->where(function ($q): void {
            $q->whereNull('retention_until')->orWhere('retention_until', '>', now());
        })->with(['medicalRequest:id,public_id', 'supersedes:id,public_id'])->orderBy('id')->limit(101)->get() : collect();
        if ($files->count() > 100 || $reports->count() > 100) {
            return $this->errorResponse('This history requires a paginated view.', 422);
        }

        return $this->successResponse(data: [
            'medical_request' => (new AdminMedicalRequestResource($row))->resolve($request),
            'files' => ReservationMedicalFileResource::collection($files)->resolve($request),
            'reports' => $reports->map(fn ($report) => (new ReservationReportResource($report))->resolve($request) + [
                'author_user_id' => $report->author_user_id,
                'can_manage' => $report->status->value === 'draft' && $report->author_user_id === $request->user()->id,
            ]),
        ])->header('Cache-Control', 'private, no-store');
    }

    public function store(Request $request, ReservationMedicalRequestService $service)
    {
        $data = $request->validate([
            'reservation_id' => ['required', 'integer', 'min:1'],
            'title' => ['required', 'string', 'max:255'],
            'instructions' => ['nullable', 'string', 'max:5000'],
            'maximum_bytes' => ['required', 'integer', 'min:1', 'max:1048576'],
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        return $this->execute(function () use ($request, $service, $data) {
            $row = $service->create($request, $request->user(), Reservation::findOrFail($data['reservation_id']),
                'document_upload', $data['title'], $data['instructions'] ?? null,
                attachmentRules: ['allowed_mime_types' => ['application/pdf'], 'max_bytes' => $data['maximum_bytes']],
                administrativeReason: trim($data['reason']));

            return $this->successResponse(data: ['public_id' => $row->public_id], status: 201);
        });
    }

    public function review(Request $request, ReservationMedicalRequest $medicalRequest, ReservationMedicalRequestService $service)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        return $this->execute(function () use ($request, $medicalRequest, $service, $data) {
            $row = $service->startReview($request, $request->user(), $medicalRequest, trim($data['reason']));

            return $this->successResponse(data: ['public_id' => $row->public_id]);
        });
    }

    public function draft(Request $request, ReservationMedicalRequest $medicalRequest, ReservationReportService $service)
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'], 'body' => ['required', 'string', 'max:20000'],
            'draft_id' => ['nullable', 'ulid'], 'supersedes_report_id' => ['nullable', 'ulid'],
            'expected_body' => ['required_with:draft_id', 'nullable', 'string', 'max:20000'],
        ]);
        $lookup = fn ($id) => $medicalRequest->reports()->where('public_id', $id)->lockForUpdate()->firstOrFail();

        return $this->execute(fn () => DB::transaction(function () use ($request, $medicalRequest, $service, $data, $lookup) {
            ReservationMedicalRequest::query()->lockForUpdate()->findOrFail($medicalRequest->id);
            $draft = isset($data['draft_id']) ? $lookup($data['draft_id']) : null;
            if ($draft !== null) {
                abort_unless($draft->body === $data['expected_body'], 409, 'Draft changed; refresh before saving.');
            }
            $row = $service->saveDraft($request, $request->user(), $medicalRequest, $data['body'],
                $draft,
                isset($data['supersedes_report_id']) ? $lookup($data['supersedes_report_id']) : null,
                trim($data['reason']));

            return $this->successResponse(data: ['public_id' => $row->public_id]);
        }));
    }

    public function publish(Request $request, ReservationMedicalRequest $medicalRequest, ReservationReport $report, ReservationReportService $service)
    {
        abort_unless($report->medical_request_id === $medicalRequest->id && $report->reservation_id === $medicalRequest->reservation_id, 404);
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        // Administrative publication retains the named author; other authors' drafts are read-only.
        abort_unless($report->author_user_id === $request->user()->id, 403);

        return $this->execute(function () use ($request, $report, $service, $data) {
            $row = $service->publish($request, $request->user(), $report, trim($data['reason']));

            return $this->successResponse(data: ['public_id' => $row->public_id]);
        });
    }

    public function download(Request $request, ReservationMedicalRequest $medicalRequest, ReservationFile $file, ReservationFileService $service)
    {
        abort_unless($file->medical_request_id === $medicalRequest->id && $file->reservation_id === $medicalRequest->reservation_id, 404);

        return $this->execute(fn () => $service->download($request, $request->user(), $file, true));
    }

    private function execute(callable $operation)
    {
        try {
            return $operation();
        } catch (DomainException|InvalidArgumentException $exception) {
            return $this->errorResponse(message: 'The clinical action is unavailable. Refresh and check its eligibility.', status: 422,
                errors: ['medical_request' => ['action_rejected']]);
        }
    }
}
