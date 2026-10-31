<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\Content\ArticleAdministrationRead;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ArticleReadController extends ApiController
{
    public function index(Request $request, ArticleAdministrationRead $reader)
    {
        return $this->respond($request, $reader, 'articles');
    }

    public function show(Request $request, ArticleAdministrationRead $reader, string $articleId)
    {
        return $this->respond($request, $reader, 'article', $articleId);
    }

    public function versions(Request $request, ArticleAdministrationRead $reader, string $articleId)
    {
        return $this->respond($request, $reader, 'article_versions', $articleId);
    }

    public function events(Request $request, ArticleAdministrationRead $reader, string $articleId)
    {
        return $this->respond($request, $reader, 'article_events', $articleId);
    }

    public function version(Request $request, ArticleAdministrationRead $reader, string $articleId, string $versionId)
    {
        return $this->respond($request, $reader, 'article_version', $articleId, $versionId);
    }

    public function terms(Request $request, ArticleAdministrationRead $reader)
    {
        return $this->respond($request, $reader, 'terms');
    }

    public function term(Request $request, ArticleAdministrationRead $reader, string $termId)
    {
        return $this->respond($request, $reader, 'term', $termId);
    }

    public function termVersions(Request $request, ArticleAdministrationRead $reader, string $termId)
    {
        return $this->respond($request, $reader, 'term_versions', $termId);
    }

    private function respond(Request $request, ArticleAdministrationRead $reader, string $operation, ?string $id = null, ?string $versionId = null)
    {
        try {
            abort_unless(config('article_content.enabled') === true, 503);
            foreach (['article_catalog_state', 'article_terms', 'article_term_versions', 'articles', 'article_versions', 'article_version_terms'] as $table) {
                abort_unless(Schema::hasTable($table), 503);
            }
            $result = $reader->read($request, $operation, $id, $versionId);

            return $this->successResponse(data: $result['data'], meta: $result['meta']);
        } catch (ValidationException) {
            return $this->errorResponse('Invalid article query.', 422);
        } catch (HttpExceptionInterface $error) {
            return $this->errorResponse('Article request could not be completed.', $error->getStatusCode());
        } catch (Throwable) {
            return $this->errorResponse('Article information is temporarily unavailable.', 503);
        }
    }
}
