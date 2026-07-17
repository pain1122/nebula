<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('marketplace_hospitals', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('timezone', 64)->default('Asia/Tehran');
            $table->char('country_code', 2)->nullable();
            $table->string('province', 120)->nullable()->index();
            $table->string('city', 120)->nullable()->index();
            $table->text('address')->nullable();
            $table->string('contact_phone', 30)->nullable();
            $table->string('contact_email')->nullable();
            $table->string('website_url', 2048)->nullable();
            $table->text('profile')->nullable();
            $table->json('filter_metadata')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('archived_at')->nullable()->index();
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('archive_reason')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'city', 'name']);
        });

        Schema::create('hospital_listing_requests', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->foreignId('requesting_user_id')->constrained('users')->restrictOnDelete();
            $table->string('proposed_name');
            $table->string('proposed_city', 120)->nullable()->index();
            $table->text('proposed_address')->nullable();
            $table->string('proposed_phone', 30)->nullable();
            $table->text('evidence_notes')->nullable();
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('review_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('marketplace_hospital_id')->nullable()->constrained('marketplace_hospitals')->nullOnDelete();
            $table->timestamps();

            $table->index(['requesting_user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hospital_listing_requests');
        Schema::dropIfExists('marketplace_hospitals');
    }
};
