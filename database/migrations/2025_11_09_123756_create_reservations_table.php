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
        Schema::create('reservations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained()->cascadeOnDelete();          // بیمار
            $t->foreignId('doctor_profile_id')->constrained()->cascadeOnDelete(); // پزشک
            $t->foreignId('checkup_id')->constrained()->cascadeOnDelete();        // چکاپ
            $t->dateTime('starts_at');
            $t->dateTime('ends_at');
            $t->string('status')->default('pending'); // pending, paid, done, canceled
            $t->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
