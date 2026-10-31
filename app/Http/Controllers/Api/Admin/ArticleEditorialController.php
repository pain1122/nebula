<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\Content\ArticleEditorial;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ArticleEditorialController extends ApiController
{
    public function context(Request $request, ArticleEditorial $editorial, string $articleId)
    {
        return $this->respond($request, $editorial, $articleId, false);
    }

    public function action(Request $request, ArticleEditorial $editorial, string $articleId)
    {
        return $this->respond($request, $editorial, $articleId, true);
    }

    private function respond(Request $request, ArticleEditorial $editorial, string $id, bool $write)
    {
        try {
            abort_unless(config('article_content.enabled') === true, 503);
            foreach (['article_catalog_state', 'article_terms', 'article_term_versions', 'articles', 'article_versions', 'article_version_terms'] as $table) {
                abort_unless(Schema::hasTable($table), 503);
            }
            $data = $write ? $editorial->act($request, $id) : $editorial->context($request, $id);

            return $this->successResponse(data: $data);
        } catch (ValidationException) {
            return $this->errorResponse('Invalid article editorial input.', 422);
        } catch (HttpExceptionInterface $error) {
            return $this->errorResponse('Article editorial request could not be completed.', $error->getStatusCode());
        } catch (QueryException $error) {
            $conflict = in_array((string) $error->getCode(), ['23000', '23505', '40001'], true);

            return $this->errorResponse('Article editorial request could not be completed.', $conflict ? 409 : 503);
        } catch (Throwable) {
            return $this->errorResponse('Article editorial information is temporarily unavailable.', 503);
        }
    }
}
