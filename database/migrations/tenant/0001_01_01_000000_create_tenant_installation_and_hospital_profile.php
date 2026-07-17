<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenant_installation', function (Blueprint $table): void {
            $table->id();
            $table->ulid('public_id')->unique();
            $table->string('installation_key', 191)->unique();
            $table->string('schema_version', 100);
            $table->timestamp('installed_at')->useCurrent();
            $table->timestamps();
        });

        Schema::create('hospital_profile', function (Blueprint $table): void {
            $table->id();
            $table->unsignedTinyInteger('singleton_key')->default(1)->unique();
            $table->ulid('public_id')->unique();
            $table->string('name');
            $table->string('domain', 191)->nullable()->unique();
            $table->string('timezone', 64)->default('Asia/Tehran');
            $table->char('currency', 3)->default('IRR');
            $table->string('locale', 20)->default('fa');
            $table->json('branding')->nullable();
            $table->json('public_contact')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hospital_profile');
        Schema::dropIfExists('tenant_installation');
    }
};
