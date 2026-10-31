<?php

namespace Database\Seeders;

use App\Models\PatientHealthSnapshot;
use App\Models\Questionnaire;
use App\Models\QuestionnaireSubmission;
use App\Models\User;
use App\Services\Health\HealthCatalog;
use App\Services\Health\PatientHealthService;
use App\Services\QuestionnaireSubmissionService;
use Database\Seeders\Support\DemoFixtureContext;
use Illuminate\Database\Seeder;

class PatientExperienceDemoSeeder extends Seeder
{
    public function run(): void
    {
        DemoFixtureContext::guard();
        foreach (['patient@checkupino.test', 'patient2@checkupino.test'] as $index => $email) {
            $patient = User::where('email', $email)->firstOrFail();
            if (! PatientHealthSnapshot::where('patient_id', $patient->id)->exists()) {
                $health = app(PatientHealthService::class);
                $context = $health->read($patient);
                $context = $health->save(DemoFixtureContext::request($patient, '/api/my/health-profile', 'PUT'), $patient, [
                    'expected_revision' => $context['revision'], 'catalog_version' => HealthCatalog::VERSION, 'confirmed' => true,
                    'changes' => ['birth_date' => $index === 0 ? '2000-01-01' : '2001-01-01',
                        'gender' => $index === 0 ? 'male' : 'female',
                        'conditions' => ['status' => $index === 0 ? 'yes' : 'no', 'codes' => $index === 0 ? ['condition.hypertension'] : []],
                        'allergies' => ['status' => $index === 0 ? 'unknown' : 'yes', 'codes' => $index === 0 ? [] : ['allergy.penicillin']],
                        'smoking' => 'no', 'alcohol' => 'no', 'low_activity' => 'yes', 'stress' => 'unknown', 'family_history' => 'declined'],
                    'measurements' => ['weight' => ['value' => $index === 0 ? '70' : '63', 'measured_on' => now('Asia/Tehran')->subDays(30)->toDateString()],
                        'height' => ['value' => $index === 0 ? '175' : '168', 'measured_on' => now('Asia/Tehran')->subDays(30)->toDateString()]],
                ]);
                $health->save(DemoFixtureContext::request($patient, '/api/my/health-profile', 'PUT'), $patient, [
                    'expected_revision' => $context['revision'], 'catalog_version' => HealthCatalog::VERSION, 'confirmed' => true,
                    'changes' => [], 'measurements' => ['weight' => ['value' => $index === 0 ? '69.5' : '64.2',
                        'measured_on' => now('Asia/Tehran')->toDateString()]],
                ]);
            }
            $questionnaire = Questionnaire::where('slug', 'demo-heart-health-screen')->with('questions.choices')->firstOrFail();
            if (! QuestionnaireSubmission::where('user_id', $patient->id)->where('questionnaire_id', $questionnaire->id)->exists()) {
                foreach ([$index, $index + 1] as $choiceIndex) {
                    $answers = $questionnaire->questions->sortBy('sort_order')->map(fn ($question): array => [
                        'question_id' => $question->id,
                        'choice_id' => $question->choices->sortBy('sort_order')->values()[$choiceIndex]->id,
                    ])->values()->all();
                    app(QuestionnaireSubmissionService::class)->submit($questionnaire->slug, [
                        'answers' => $answers, 'submitter_name' => $patient->name, 'submitter_phone' => $patient->phone,
                    ], $patient);
                }
            }
        }
    }
}
