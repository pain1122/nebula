<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRecentPasswordConfirmation
{
    public function handle(Request $request, Closure $next, ?string $safeRoute = null): Response
    {
        $timeout = (int) config('auth.high_authority_password_timeout', 900);

        if (! $request->hasSession()) {
            return $this->confirmationRequired($request, $safeRoute);
        }

        $confirmedAt = (int) $request->session()->get('auth.password_confirmed_at', 0);

        if ($confirmedAt <= 0 || ($confirmedAt + $timeout) < time()) {
            return $this->confirmationRequired($request, $safeRoute);
        }

        return $next($request);
    }

    private function confirmationRequired(Request $request, ?string $safeRoute): Response
    {
        if ($request->expectsJson() || ! $request->hasSession() || ! $safeRoute) {
            return $this->jsonConfirmationRequired();
        }

        $intendedUrl = route($safeRoute, $request->route()?->parameters() ?? []);
        $query = $request->except(['_token', '_method']);

        if ($query !== []) {
            $intendedUrl .= '?'.http_build_query($query);
        }

        $request->session()->put('url.intended', $intendedUrl);

        return redirect()->route('password.confirm');
    }

    private function jsonConfirmationRequired(): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => 'Recent password confirmation required.',
            'errors' => [
                'password_confirmation' => ['required'],
            ],
        ], 423);
    }
}
