<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // role: admin | doctor | user
            $table->string('role', 30)->default('user')->after('password')->index();

            // Required profile fields
            $table->string('first_name', 100)->after('role');
            $table->string('last_name', 100)->after('first_name');

            $table->string('phone', 30)->after('email')->unique();
            $table->date('birth_date')->after('phone');
            $table->string('NID', 10)->after('birth_date')->unique();

            // Optional profile fields
            $table->string('city', 120)->nullable()->after('NID');
            $table->string('country', 120)->nullable()->after('city');
            $table->string('zip_code', 20)->nullable()->after('country');
            $table->text('bio')->nullable()->after('zip_code');

            // future multi-tenant
            $table->unsignedBigInteger('tenant_id')->nullable()->after('bio')->index();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // drop indexes first (unique creates an index)
            $table->dropIndex(['role']);
            $table->dropUnique(['phone']);
            $table->dropUnique(['NID']);
            $table->dropIndex(['tenant_id']);

            $table->dropColumn([
                'role',
                'first_name',
                'last_name',
                'phone',
                'birth_date',
                'NID',
                'city',
                'country',
                'zip_code',
                'bio',
                'tenant_id',
            ]);
        });
    }
};
