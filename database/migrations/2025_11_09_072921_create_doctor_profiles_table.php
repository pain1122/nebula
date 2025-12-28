<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('doctor_profiles', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();
            $t->foreignId('specialty_id')->nullable()->constrained('specialties')->nullOnDelete();
            $t->string('phone')->nullable();
            $t->unsignedInteger('experience_years')->default(0);
            $t->unsignedInteger('fee')->default(0);
            $t->text('bio')->nullable();
            $t->json('availability')->nullable();
            $t->boolean('verified')->default(false);
            $t->timestamps();
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('doctor_profiles');
    }
};
