<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\Content\ArticleMediaLibrary;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ArticleMediaController extends ApiController
{
    public function index(Request $request, ArticleMediaLibrary $library)
    {
        return $this->respond($request, $library, 'read');
    }

    public function show(Request $request, ArticleMediaLibrary $library, string $assetId)
    {
        return $this->respond($request, $library, 'read', $assetId);
    }

    public function context(Request $request, ArticleMediaLibrary $library)
    {
        return $this->respond($request, $library, 'uploadContext');
    }

    public function upload(Request $request, ArticleMediaLibrary $library)
    {
        return $this->respond($request, $library, 'upload');
    }

    public function action(Request $request, ArticleMediaLibrary $library, string $assetId)
    {
        return $this->respond($request, $library, 'act', $assetId);
    }

    public function content(Request $request, ArticleMediaLibrary $library, string $assetId)
    {
        return $this->respond($request, $library, 'content', $assetId);
    }

    private function respond(Request $request, ArticleMediaLibrary $library, string $operation, ?string $id = null)
    {
        try {
            $data = $library->{$operation}($request, ...($id === null ? [] : [$id]));
            if ($operation === 'content') {
                return response()->stream(function () use ($data) {
                    try {
                        fpassthru($data['stream']);
                    } finally {
                        fclose($data['stream']);
                    }
                }, 200, ['Content-Type' => $data['mime'], 'Content-Length' => (string) $data['bytes'],
                    'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox",
                    'Content-Disposition' => 'inline']);
            }

            return $this->successResponse(data: $data, status: $operation === 'upload' ? 201 : 200);
        } catch (ValidationException) {
            return $this->errorResponse('Invalid editorial media input.', 422);
        } catch (HttpExceptionInterface $error) {
            return $this->errorResponse('Editorial media request could not be completed.', $error->getStatusCode());
        } catch (QueryException $error) {
            return $this->errorResponse('Editorial media request could not be completed.', in_array((string) $error->getCode(), ['23000', '23505', '40001'], true) ? 409 : 503);
        } catch (Throwable) {
            return $this->errorResponse('Editorial media is temporarily unavailable.', 503);
        }
    }
}
