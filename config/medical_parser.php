<?php

return [
    // No TCP endpoint, remote URL, Docker socket or inline production fallback.
    'socket' => '/run/medical-content/content.sock',
    // Checked together with APP_ENV=testing; ignored in all other environments.
    'test_inline' => true,
];
