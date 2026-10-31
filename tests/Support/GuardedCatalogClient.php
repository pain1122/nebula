<?php

namespace Tests\Support;

/** Existing behavioral regressions now submit the revision/confirmation rendered by the guarded form. */
trait GuardedCatalogClient
{
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $actor = $this->app['auth']->user();
        if (in_array(strtoupper($method), ['POST', 'PUT', 'PATCH', 'DELETE'], true)
            && preg_match('~/admin/(checkups|checkup-categories|specialties)(?:/(\d+))?/?$~', parse_url($uri, PHP_URL_PATH), $match)
            && $actor?->canAccessAdminPanel()
            && (int) $this->app['session.store']->get('auth.password_confirmed_at', 0) > time() - 300) {
            $parameters += ['expected_revision' => app(\App\Services\CatalogAdministration::class)->context($match[1], isset($match[2]) ? (int) $match[2] : null, $actor)['revision'], 'confirmed' => true];
        }

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
