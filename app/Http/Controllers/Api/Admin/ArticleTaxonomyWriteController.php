<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\Content\ArticleTaxonomyWrite;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ArticleTaxonomyWriteController extends ApiController
{
    public function context(Request $request, ArticleTaxonomyWrite $writer, ?string $termId = null)
    {
        return $this->respond($request, $writer, 'context', $termId);
    }

    public function store(Request $request, ArticleTaxonomyWrite $writer)
    {
        return $this->respond($request, $writer, 'create');
    }

    public function update(Request $request, ArticleTaxonomyWrite $writer, string $termId)
    {
        return $this->respond($request, $writer, 'update', $termId);
    }

    public function action(Request $request, ArticleTaxonomyWrite $writer, string $termId)
    {
        return $this->respond($request, $writer, 'retire', $termId);
    }

    private function respond(Request $request, ArticleTaxonomyWrite $writer, string $operation, ?string $id = null)
    {
        try {
            abort_unless(config('article_content.enabled') === true, 503);
            foreach (['article_catalog_state', 'article_terms', 'article_term_versions', 'articles', 'article_versions', 'article_version_terms'] as $table) {
                abort_unless(Schema::hasTable($table), 503);
            }
            $data = $operation === 'context' ? $writer->context($request, $id) : $writer->mutate($request, $id, $operation);

            return $this->successResponse(data: $data, status: $operation === 'create' ? 201 : 200);
        } catch (ValidationException) {
            return $this->errorResponse('Invalid article taxonomy input.', 422);
        } catch (HttpExceptionInterface $error) {
            return $this->errorResponse('Article taxonomy request could not be completed.', $error->getStatusCode());
        } catch (QueryException $error) {
            $conflict = in_array((string) $error->getCode(), ['23000', '23505', '40001'], true);

            return $this->errorResponse('Article taxonomy request could not be completed.', $conflict ? 409 : 503);
        } catch (Throwable) {
            return $this->errorResponse('Article taxonomy is temporarily unavailable.', 503);
        }
    }
}
