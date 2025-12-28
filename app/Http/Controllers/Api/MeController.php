<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;

class MeController extends ApiController
{
    public function __invoke(Request $request)
    {
        $user = $request->user();

        return $this->successResponse(
            data: $this->formatUser($user),
            message: 'Current user info.'
        );
    }
}
