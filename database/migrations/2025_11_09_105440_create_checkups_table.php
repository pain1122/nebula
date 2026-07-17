<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('checkups', function (Blueprint $t): void {
            $t->id();
            $t->ulid('public_id')->unique();
            $t->foreignId('checkup_category_id')->nullable()->constrained()->nullOnDelete();
            $t->string('title');
            $t->string('slug')->unique();
            $t->text('description')->nullable();
            $t->unsignedBigInteger('price')->default(0);
            $t->char('currency', 3)->default('IRR');
            $t->unsignedSmallInteger('default_duration_minutes')->default(30);
            $t->boolean('is_active')->default(true)->index();
            $t->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $t->text('archive_reason')->nullable();
            $t->softDeletes();
            $t->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('checkups');
    }
};
