<?php

namespace Database\Seeders\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use LogicException;

final class DemoFixtureContext
{
    public const EMAILS = ['rootadmin@checkupino.test', 'admin@checkupino.test', 'doctor@checkupino.test',
        'patient@checkupino.test', 'doctor2@checkupino.test', 'patient2@checkupino.test'];

    public static function guard(): void
    {
        if (! app()->environment(['local', 'testing']) || ! config('demo.seed_enabled')) {
            throw new LogicException('Synthetic fixtures require the enabled local/testing seed profile.');
        }
    }

    public static function guardOwnedDatabase(): void
    {
        self::guard();
        if (! Schema::hasTable('users') || User::whereNotIn('email', self::EMAILS)->exists()) {
            throw new LogicException('Synthetic seeding refuses an unmigrated database or accounts outside its own fixture set.');
        }
    }

    public static function request(User $actor, string $path, string $method = 'GET', array $data = [], bool $confirmPassword = false): Request
    {
        self::guard();
        $actor = $actor->fresh('roles');
        $request = Request::create($path, $method, $method === 'GET' ? $data : [], server: [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'REMOTE_ADDR' => '127.0.0.1',
        ], content: $method === 'GET' ? null : json_encode($data, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        $request->setUserResolver(fn () => $actor);
        if ($confirmPassword) {
            if (! Hash::check((string) config('demo.password'), $actor->getAuthPassword())) {
                throw new LogicException('Seed actor password differs; existing credentials will not be replaced.');
            }
            $session = new Store('synthetic-demo-seed', new ArraySessionHandler(30));
            $session->start();
            $session->put('auth.password_confirmed_at', time());
            $request->setLaravelSession($session);
        }

        return $request;
    }
}
