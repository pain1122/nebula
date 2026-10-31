<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservation_medical_requests', function (Blueprint $table): void {
            $table->json('attachment_policy')->nullable();
            $table->char('attachment_policy_revision', 64)->nullable();
        });
    }

    public function down(): void
    {
        // Prefer reverting application code while retaining these nullable columns.
        // Never discard issued policy history, including soft-deleted requests.
        if (DB::table('reservation_medical_requests')
            ->whereNotNull('attachment_policy')
            ->orWhereNotNull('attachment_policy_revision')
            ->exists()) {
            throw new DomainException('Attachment policy data exists. Retain the columns when reverting application code.');
        }

        Schema::table('reservation_medical_requests', function (Blueprint $table): void {
            $table->dropColumn(['attachment_policy', 'attachment_policy_revision']);
        });
    }
};
