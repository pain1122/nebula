<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'article-media' => [
            'driver' => env('ARTICLE_MEDIA_STORAGE_DRIVER', 'local'),
            'root' => storage_path('app/article-media'),
            'visibility' => 'private', 'serve' => false, 'throw' => true,
            'key' => env('ARTICLE_MEDIA_S3_ACCESS_KEY_ID'),
            'secret' => env('ARTICLE_MEDIA_S3_SECRET_ACCESS_KEY'),
            'region' => env('ARTICLE_MEDIA_S3_REGION', 'us-east-1'),
            'bucket' => env('ARTICLE_MEDIA_S3_BUCKET'),
            'endpoint' => env('ARTICLE_MEDIA_S3_ENDPOINT'),
            'allow_insecure_http' => env('ARTICLE_MEDIA_S3_ALLOW_INSECURE_HTTP', false),
            'use_path_style_endpoint' => env('ARTICLE_MEDIA_S3_USE_PATH_STYLE_ENDPOINT', true),
            'http' => ['connect_timeout' => 3, 'timeout' => 30, 'verify' => true],
            'retries' => 1,
        ],

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => false,
            'throw' => false,
            'report' => false,
        ],

        'private' => [
            'driver' => env('MEDICAL_STORAGE_DRIVER', 'local'),
            'root' => env('MEDICAL_STORAGE_DRIVER', 'local') === 'local'
                ? (env('MEDICAL_LOCAL_STORAGE_ROOT') ?: storage_path('app/private')) : '',
            'visibility' => 'private',
            'serve' => false,
            'throw' => true,
            'report' => true,
            // Dedicated medical credentials; never inherit public-storage credentials.
            'key' => env('MEDICAL_S3_ACCESS_KEY_ID'),
            'secret' => env('MEDICAL_S3_SECRET_ACCESS_KEY'),
            'region' => env('MEDICAL_S3_REGION', 'us-east-1'),
            'bucket' => env('MEDICAL_S3_BUCKET'),
            'endpoint' => env('MEDICAL_S3_ENDPOINT'),
            'use_path_style_endpoint' => env('MEDICAL_S3_USE_PATH_STYLE_ENDPOINT', true),
            'allow_insecure_http' => env('MEDICAL_S3_ALLOW_INSECURE_HTTP', false),
            'http' => ['connect_timeout' => 3, 'timeout' => 30, 'verify' => true],
            'retries' => 1,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
