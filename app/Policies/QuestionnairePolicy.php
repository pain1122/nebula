<?php

namespace App\Policies;

use App\Models\Questionnaire;
use App\Models\User;

class QuestionnairePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function view(User $user, Questionnaire $questionnaire): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function create(User $user): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function update(User $user, Questionnaire $questionnaire): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function delete(User $user, Questionnaire $questionnaire): bool
    {
        return $user->canAccessAdminPanel();
    }
}
