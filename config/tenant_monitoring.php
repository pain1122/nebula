<?php

$machineSecrets = json_decode((string) env('TENANT_MONITORING_MACHINE_SECRETS', '{}'), true);

return [
    'signature_algorithm' => 'hmac-sha256',
    'max_age_seconds' => (int) env('TENANT_MONITORING_MAX_AGE_SECONDS', 300),
    'machine_secrets' => is_array($machineSecrets) ? $machineSecrets : [],
];
