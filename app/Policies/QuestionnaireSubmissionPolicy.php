<?php

namespace App\Policies;

use App\Models\QuestionnaireSubmission;
use App\Models\User;

class QuestionnaireSubmissionPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function view(User $user, QuestionnaireSubmission $submission): bool
    {
        return $user->canAccessAdminPanel();
    }

    public function delete(User $user, QuestionnaireSubmission $submission): bool
    {
        return $user->canAccessAdminPanel();
    }
}
