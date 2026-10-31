<?php

namespace Tests\Feature\Architecture;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Bootstrap\LoadConfiguration;
use Illuminate\Foundation\Testing\TestCase;

class LocalReservationDebugRouteTest extends TestCase
{
    public function createApplication()
    {
        $app = require Application::inferBasePath().'/bootstrap/app.php';
        $this->traitsUsedByTest = array_flip(class_uses_recursive(static::class));

        // Load local-only routes without changing the isolated test database.
        $app->afterBootstrapping(LoadConfiguration::class, function (Application $app): void {
            $app->detectEnvironment(fn (): string => 'local');
            $app['config']->set('app.env', 'local');
        });
        $app->make(Kernel::class)->bootstrap();

        return $app;
    }

    public function test_local_mode_does_not_expose_the_latest_reservation_to_guests(): void
    {
        $this->assertTrue($this->app->environment('local'));
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));

        $this->getJson('/debug/res-last')->assertNotFound();
    }
}
