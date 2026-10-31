<?php

return [
    // Server-owned validation policy, separate from upload size/permission rules.
    // Changes produce a new revision; no setting may disable validation.
    'version' => 1,
    'image' => [
        'max_width' => 8192,
        'max_height' => 8192,
        'max_pixels' => 16000000,
    ],
    'pdf' => [
        'max_pages' => 200,
        'max_objects' => 20000,
        // Encryption and interactive/embedded content are unsupported in v1.
        'forbidden_names' => [
            '/A', '/AA', '/AcroForm', '/Collection', '/EmbeddedFile', '/EmbeddedFiles',
            '/Filespec', '/GoToE', '/GoToR', '/JavaScript', '/JS', '/Launch',
            '/Movie', '/OpenAction', '/RichMedia', '/Sound', '/SubmitForm',
            '/URI', '/XFA', '/3D',
        ],
    ],
    'resources' => [
        'timeout_seconds' => 10,
        'cpu_seconds' => 8,
        'address_space_bytes' => 268435456,
        'max_output_bytes' => 4194304,
    ],
];
