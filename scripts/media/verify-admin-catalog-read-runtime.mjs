import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

assert.equal(process.argv.length, 2, 'No account/container/endpoint overrides accepted.');
const path = 'docs/deployment/evidence/admin-catalog-read-runtime-2026-10-14.json';
assert.ok(!existsSync(path), 'Evidence already exists; inspect instead of overwriting.');
const expected = JSON.parse(readFileSync('docs/deployment/evidence/demo-appointment-completed-final-2026-10-11.json', 'utf8')).final.hashes;
const php = `<?php
require '/var/www/vendor/autoload.php';$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Http\\Request;
if(posix_geteuid()!==33||config('database.default')!=='mysql')throw new RuntimeException('UID33 MySQL required.');
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();
try {
 $fingerprints=function(){
  $tables=['reservation_medical_requests','reservation_files','reservation_reports','jobs','setting_values','reservations','reservation_payment_summaries','payment_attempts','outbox_events','audit_events','questionnaire_submissions','leads'];$hashes=[];
  foreach($tables as $table)$hashes[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $stable=App\\Models\\Reservation::findOrFail(8)->getAttributes();unset($stable['status'],$stable['completed_at'],$stable['updated_at']);$hashes['target_stable']=hash('sha256',json_encode($stable,JSON_THROW_ON_ERROR));
  $hashes['other_reservations']=hash('sha256',json_encode(DB::table('reservations')->where('id','!=',8)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
  $hashes['protected']=hash('sha256',json_encode(App\\Models\\User::whereIn('id',[7,8])->with('roles:id,name')->get(['id','public_id','account_state','patient_status','updated_at'])->toArray(),JSON_THROW_ON_ERROR));
  return $hashes;
 };
 $before=$fingerprints();$catalogBefore=[];
 foreach(['checkups','checkup_categories','doctor_workplace_checkup','doctor_visit_slots'] as $table)$catalogBefore[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 $checkup=App\\Models\\Checkup::withTrashed()->findOrFail(5);if(!$checkup->checkup_category_id)throw new RuntimeException('Existing demo category required.');
 $checks=[];
 foreach([2,1] as $id){
  $actor=App\\Models\\User::with('roles')->findOrFail($id);
  if(!str_ends_with($actor->email,'@checkupino.test')||!$actor->canAccessAdminPanel())throw new RuntimeException('Synthetic admin required.');
  foreach([
   ['checkups','/api/admin/checkups?state=all&category_id='.$checkup->checkup_category_id.'&currency='.$checkup->currency.'&min_price='.$checkup->price.'&max_price='.$checkup->price,null],
   ['checkup','/api/admin/checkups/'.$checkup->id,(string)$checkup->id],
   ['categories','/api/admin/checkup-categories?state=all',null],
   ['category','/api/admin/checkup-categories/'.$checkup->checkup_category_id,(string)$checkup->checkup_category_id],
   ['checkups','/api/admin/checkups?q='.rawurlencode('%'). '&state=all',null]
  ] as [$method,$uri,$selected]){
   $request=Request::create($uri,'GET');$request->headers->set('Accept','application/json');$app->instance('request',$request);$request->setUserResolver(fn()=>$actor);
   $response=$selected===null?$app->make(App\\Http\\Controllers\\Api\\Admin\\CatalogReadController::class)->$method($request):$app->make(App\\Http\\Controllers\\Api\\Admin\\CatalogReadController::class)->$method($request,$selected);
   $body=json_decode($response->getContent(),true,512,JSON_THROW_ON_ERROR);
   if($response->getStatusCode()!==200||$response->headers->get('Cache-Control')!=='no-store, private')throw new RuntimeException('Read/cache contract failed.');
   if(str_contains($response->getContent(),'archive_reason')||str_contains($response->getContent(),'archived_by')||str_contains($response->getContent(),$actor->email))throw new RuntimeException('Private fields exposed.');
   if($method==='checkups'&&!str_contains($uri,'q=')&&!in_array($checkup->id,array_column($body['data'],'id'),true))throw new RuntimeException('Composed exact-price/category/currency fixture missing.');
   if(str_contains($uri,'q='))foreach($body['data'] as $row)if(!str_contains($row['title'],'%')&&!str_contains($row['slug'],'%')&&!str_contains($row['public_id'],'%'))throw new RuntimeException('Wildcard must be literal.');
   $checks[]=['actor_id'=>$id,'method'=>$method,'status'=>200,'cache_control'=>$response->headers->get('Cache-Control'),'rows'=>isset($body['meta']['pagination'])?count($body['data']):1,'total'=>$body['meta']['pagination']['total']??null,'keys'=>array_keys(isset($body['meta']['pagination'])?($body['data'][0]??[]):$body['data'])];
  }
 }
 $after=$fingerprints();$catalogAfter=[];foreach(array_keys($catalogBefore) as $table)$catalogAfter[$table]=hash('sha256',json_encode(DB::table($table)->orderBy('id')->get(),JSON_THROW_ON_ERROR));
 if($before!==$after||$catalogBefore!==$catalogAfter)throw new RuntimeException('Read changed data.');
 echo json_encode(['checks'=>$checks,'baseline'=>$before,'final'=>$after,'catalog_baseline'=>$catalogBefore,'catalog_final'=>$catalogAfter],JSON_THROW_ON_ERROR);
}catch(Throwable $error){fwrite(STDERR,json_encode(['error_class'=>get_class($error),'message'=>substr(preg_replace('/[A-Z0-9._%+-]+@[A-Z0-9.-]+/i','[redacted]',$error->getMessage()),0,250)],JSON_THROW_ON_ERROR));DB::rollBack();exit(1);}finally{if(DB::transactionLevel())DB::rollBack();}
`;
const result = spawnSync('docker', ['exec', '-i', '--user', 'www-data', 'checkupino_app', 'php'], { input: php, encoding: 'utf8', windowsHide: true, timeout: 30000 });
assert.equal(result.status, 0, 'Read-only MySQL verification failed: ' + result.stderr);
const runtime = JSON.parse(result.stdout);
assert.deepEqual(runtime.baseline, expected);
assert.deepEqual(runtime.final, expected);
assert.deepEqual(runtime.catalog_baseline, runtime.catalog_final);
const guest = [];
for (const suffix of ['checkups', 'checkups/5', 'checkup-categories', 'checkup-categories/1']) {
  const response = await fetch('http://localhost:8080/api/admin/' + suffix, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 401);
  guest.push({ path: '/api/admin/' + suffix, status: response.status });
}
const sources = ['app/Http/Controllers/Api/Admin/CatalogReadController.php', 'routes/api.php', 'tests/Feature/Api/AdminCatalogReadContractTest.php', 'scripts/media/verify-admin-catalog-read.ps1', 'scripts/media/verify-admin-catalog-read-runtime.mjs'].map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
writeFileSync(path, JSON.stringify({ acceptance: 'passed', checked_at: new Date().toISOString(), ...runtime, guest, sources, scope: 'UID33 transaction-read-only direct MySQL controller checks for existing synthetic admin/root; four actual guest HTTP refusals. Direct controller acceptance does not establish authenticated browser/panel acceptance. No business writes, scanner/worker/Compose operation or schema change.' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: 'passed', mysql_checks: runtime.checks.length, guest_refusals: guest.length, data_and_protected_fingerprints_preserved: true, catalog_fingerprints_preserved: true }));
