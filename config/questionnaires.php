<?php

return [
    'submission_limits' => [
        'per_user_per_minute' => (int) env('QUESTIONNAIRE_SUBMISSIONS_PER_USER_PER_MINUTE', 10),
        'per_phone_per_minute' => (int) env('QUESTIONNAIRE_SUBMISSIONS_PER_PHONE_PER_MINUTE', 5),
        'per_ip_per_minute' => (int) env('QUESTIONNAIRE_SUBMISSIONS_PER_IP_PER_MINUTE', 30),
    ],
];
