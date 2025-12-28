<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('questionnaires', function (Blueprint $table) {
            $table->id();
            $table->string('title', 255);
            $table->string('slug', 255)->unique();
            $table->string('status', 20)->default('draft'); // draft|published
            $table->string('cover_image_url', 1024)->nullable();
            $table->longText('content_html')->nullable(); // RichTextEditor output
            $table->timestamps();
        });
    }

    public function down(): void {
        Schema::dropIfExists('questionnaires');
    }
};
