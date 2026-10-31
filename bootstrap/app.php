<?php

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Only routes carrying this middleware change: wrap auth refusals with private/no-store.
        $middleware->prependToPriorityList(
            \Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests::class,
            \App\Http\Middleware\ArticleReadPrivacy::class,
        );
        $middleware->appendToGroup('api', \App\Http\Middleware\AttachApiContractContext::class);
        // ⬇️ alias ها
        $middleware->statefulApi();
        $middleware->alias([
            // Spatie Permission
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            'verified' => \Illuminate\Auth\Middleware\EnsureEmailIsVerified::class,
            'password.confirmed.recent' => \App\Http\Middleware\EnsureRecentPasswordConfirmation::class,
            'account.active' => \App\Http\Middleware\EnsureAccountIsActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (ValidationException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'success' => false,
                'message' => 'The request data is invalid.',
                'code' => 'validation_failed',
                'errors' => $exception->errors(),
                'meta' => [
                    'api_version' => '1',
                    'correlation_id' => $request->attributes->get('correlation_id'),
                ],
            ], 422);
        });

        $exceptions->render(function (AuthorizationException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'forbidden',
                'errors' => null,
                'meta' => [
                    'api_version' => '1',
                    'correlation_id' => $request->attributes->get('correlation_id'),
                ],
            ], 403);
        });

        $exceptions->render(function (ThrottleRequestsException $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return response()->json([
                'success' => false,
                'message' => 'Too many requests.',
                'code' => 'rate_limited',
                'errors' => null,
                'meta' => [
                    'api_version' => '1',
                    'correlation_id' => $request->attributes->get('correlation_id'),
                ],
            ], 429, $exception->getHeaders());
        });
    })->create();
