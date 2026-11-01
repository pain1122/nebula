<?php

namespace App\Http\Controllers\Api;

use App\Services\Content\PatientArticleRead;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class PatientArticleController extends ApiController
{
    public function index(Request $request, PatientArticleRead $reader)
    {
        return $this->respond($request, $reader, 'articles');
    }

    public function taxonomies(Request $request, PatientArticleRead $reader)
    {
        return $this->respond($request, $reader, 'taxonomies');
    }

    public function show(Request $request, PatientArticleRead $reader, string $articleId)
    {
        return $this->respond($request, $reader, 'article', $articleId);
    }

    public function media(Request $request, PatientArticleRead $reader, string $articleId, string $assetId)
    {
        return $this->respond($request, $reader, 'media', $articleId, $assetId);
    }

    private function respond(Request $request, PatientArticleRead $reader, string $operation, ?string $id = null, ?string $assetId = null)
    {
        try {
            $result = $reader->read($request, $operation, $id, $assetId);
            if ($operation === 'media') {
                return response()->stream(function () use ($result) {
                    try {
                        fpassthru($result['stream']);
                    } finally {
                        fclose($result['stream']);
                    }
                }, 200, ['Content-Type' => $result['mime'], 'Content-Length' => (string) $result['bytes'],
                    'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; sandbox",
                    'Content-Disposition' => 'inline']);
            }

            return $this->successResponse(data: $result['data'], meta: $result['meta'] ?? []);
        } catch (ValidationException) {
            return $this->errorResponse('Invalid article query.', 422);
        } catch (HttpExceptionInterface $error) {
            return $this->errorResponse('Article request could not be completed.', $error->getStatusCode());
        } catch (Throwable) {
            return $this->errorResponse('Articles are temporarily unavailable.', 503);
        }
    }
}
