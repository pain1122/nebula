<?php

namespace App\Enums;

enum QuestionnaireStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
}
