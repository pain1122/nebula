<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('checkup_doctor', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checkup_id')->constrained('checkups')->cascadeOnDelete();
            $table->foreignId('doctor_profile_id')->constrained('doctor_profiles')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['checkup_id', 'doctor_profile_id'], 'checkup_doctor_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('checkup_doctor');
    }
};
