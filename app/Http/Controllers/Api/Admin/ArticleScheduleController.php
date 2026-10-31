<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Api\ApiController;
use App\Services\Content\ArticlePublicationSchedules;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

final class ArticleScheduleController extends ApiController
{
    public function context(Request $request, ArticlePublicationSchedules $schedules, string $articleId)
    {
        return $this->respond($request, $schedules, $articleId, false);
    }

    public function action(Request $request, ArticlePublicationSchedules $schedules, string $articleId)
    {
        return $this->respond($request, $schedules, $articleId, true);
    }

    private function respond(Request $request, ArticlePublicationSchedules $schedules, string $id, bool $write)
    {
        try {
            abort_unless(config('article_content.enabled') === true && config('article_content.scheduling_enabled') === true, 503);
            $data = $write ? $schedules->act($request, $id) : $schedules->context($request, $id);

            return $this->successResponse(data: $data);
        } catch (ValidationException) {
            return $this->errorResponse('Invalid article scheduling input.', 422);
        } catch (HttpExceptionInterface $error) {
            return $this->errorResponse('Article scheduling request could not be completed.', $error->getStatusCode());
        } catch (QueryException $error) {
            return $this->errorResponse('Article scheduling request could not be completed.',
                in_array((string) $error->getCode(), ['23000', '23505', '40001'], true) ? 409 : 503);
        } catch (Throwable) {
            return $this->errorResponse('Article scheduling is temporarily unavailable.', 503);
        }
    }
}
