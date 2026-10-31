import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

assert.equal(process.argv.length, 2, 'No endpoint/account overrides accepted.');

// Existing synthetic demo credentials stay in memory. Protected users never log in.
const password = readFileSync('.env', 'utf8').match(/^DEMO_SEED_PASSWORD=(.*)$/m)?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
assert.ok(password, 'Configured demo password required.');
const snapshot = (submissionLimit = null) => {
  const php = `<?php
require '/var/www/vendor/autoload.php'; $app=require '/var/www/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Illuminate\\Support\\Facades\\DB;
DB::statement('SET TRANSACTION READ ONLY'); DB::beginTransaction();
try {
 $r=App\\Models\\Reservation::with(['doctor.user.roles','user.roles'])->findOrFail(8);
 $m=$r->medicalRequests()->where('public_id','01m4hfgan168p6q5ftp528285f')->firstOrFail();
 $target=$m->files()->sole();$ownerRequest=Illuminate\\Http\\Request::create('/internal/read-only-receipt');$ownerRequest->setUserResolver(fn()=>$r->user);
 $receipt=(new App\\Http\\Resources\\ReservationMedicalFileResource($target))->resolve($ownerRequest);
 App\\Support\\VerifiedPrivateFile::open($target);
 $uploadAudit=App\\Models\\AuditEvent::where('subject_public_id',$target->public_id)->where('action','reservation_medical_file.uploaded')->sole();
 if($target->uploaded_by!==4 || $target->reservation_id!==8 || $target->scan_status!==App\\Enums\\ReservationFileScanStatus::Clean || $target->scanned_at===null || $uploadAudit->actor_user_id!==4)throw new RuntimeException('Committed synthetic upload binding rejected.');
 $submissionLimit=${submissionLimit??'null'};$submissionLimit??=(int)DB::table('questionnaire_submissions')->max('id');
 $q=App\\Models\\Questionnaire::where('slug','demo-heart-health-screen')->where('status','published')->with(['questions'=>fn($x)=>$x->orderBy('sort_order')->orderBy('id')->with(['choices'=>fn($y)=>$y->orderBy('sort_order')->orderBy('id')]),'recommendations'=>fn($x)=>$x->orderBy('priority')->orderBy('min_score')->orderBy('max_score')->orderBy('id')])->sole();
 $answers=[];$expectedScore=0;foreach($q->questions as $index=>$question){$choice=$question->choices->get($index===0?1:0);if(!$choice)throw new RuntimeException('Fixture choice missing.');$answers[]=['question_id'=>$question->id,'choice_id'=>$choice->id];$expectedScore+=(int)$choice->score;}
 $recommendation=$q->recommendations->first(fn($x)=>$expectedScore>=(int)$x->min_score&&$expectedScore<=(int)$x->max_score);
 $tables=['questionnaires','questionnaire_questions','questionnaire_choices','questionnaire_recommendations','leads','reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events']; $hashes=[];
 foreach($tables as $table) $hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['existing_submissions']=hash('sha256',json_encode(DB::table('questionnaire_submissions')->where('id','<=',$submissionLimit)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['all_audits']=hash('sha256',json_encode(DB::table('audit_events')->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
 $hashes['pipeline_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::where('id','<=',11)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));$hashes['original_request']=hash('sha256',json_encode(DB::table('reservation_medical_requests')->where('public_id','01m4dn9fq2d38xxrh4wtkyf6s4')->first(),JSON_THROW_ON_ERROR));$hashes['existing_audits']=hash('sha256',json_encode(App\\Models\\AuditEvent::where('id','<=',9)->orderBy('id')->get()->toArray(),JSON_THROW_ON_ERROR));
 echo json_encode(['questionnaire'=>['id'=>$q->id,'slug'=>$q->slug,'version'=>$q->version,'questions'=>$q->questions->count(),'answers'=>$answers,'expected_score'=>$expectedScore,'recommendation'=>$recommendation?['title'=>$recommendation->title,'body_html'=>$recommendation->body_html]:null], 'submission_limit'=>$submissionLimit,'submission_count'=>DB::table('questionnaire_submissions')->count(),'new_submissions'=>DB::table('questionnaire_submissions')->where('id','>',$submissionLimit)->orderBy('id')->get(['public_id','questionnaire_id','questionnaire_version','user_id','guest_token_hash','guest_phone','answers_json','total_score','result_title','result_body_html','submitter_name','submitter_phone'])->all(),'reservation'=>$r->public_id,'request'=>$m->public_id,'request_title'=>$m->title,'file'=>App\\Models\\ReservationFile::firstOrFail()->public_id,'request_status'=>$m->status->value,'scanning'=>config('medical.scanner.enabled'),'private_driver'=>config('filesystems.disks.private.driver'),
 'counts'=>['requests'=>DB::table('reservation_medical_requests')->count(),'files'=>DB::table('reservation_files')->count(),'reports'=>DB::table('reservation_reports')->count(),'jobs'=>DB::table('jobs')->count()],
 'reports'=>$m->reports()->orderBy('id')->get(['public_id','status','supersedes_report_id'])->toArray(),'new_audits'=>App\\Models\\AuditEvent::where('id','>',11)->orderBy('id')->get(['id','actor_user_id','action','subject_public_id'])->toArray(),'receipt'=>$receipt,'checksum'=>$target->checksum_sha256,'upload_audit_id'=>$uploadAudit->id,'original_file_hash'=>hash('sha256',json_encode(DB::table('reservation_files')->where('public_id','01M4DN9XK0Z7CKQ2GFBHSACA6H')->first(),JSON_THROW_ON_ERROR)), 'target_files'=>$m->files()->get(['public_id','scan_status','size_bytes'])->toArray(), 'accounts'=>collect([$r->user,$r->doctor->user,App\\Models\\User::with('roles')->findOrFail(3),App\\Models\\User::with('roles')->findOrFail(2),App\\Models\\User::with('roles')->findOrFail(1)])->map(fn($u)=>['id'=>$u->id,'email'=>$u->email,'roles'=>$u->roles->pluck('name')->all()])->all(),
 'hashes'=>$hashes],JSON_THROW_ON_ERROR);
} finally { DB::rollBack(); }
`;
  const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  assert.equal(result.status, 0, 'Readonly synthetic fixture snapshot failed.');
  return JSON.parse(result.stdout);
};

const state=snapshot(0);console.log(JSON.stringify({counts:state.counts,submission_count:state.submission_count,new_submissions:state.new_submissions,hashes:state.hashes,questionnaire:state.questionnaire}));
