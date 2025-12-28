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
        Schema::create('specialties', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->string('slug')->unique();
            $t->foreignId('parent_id')->nullable()->constrained('specialties')->nullOnDelete();
            $t->unsignedInteger('level')->default(0);
            $t->timestamps();
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('specialties', function (Blueprint $t) {
            $t->dropConstrainedForeignId('parent_id');
            $t->dropColumn('level');
        });
    }
};
