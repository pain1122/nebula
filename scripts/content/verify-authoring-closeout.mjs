// Read-only reconciliation of the accepted one-time synthetic authoring flow.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {snapshot, runtime, docker} from '../health/activation-state.mjs';

assert.equal(process.argv.length, 2);
const before = JSON.parse(readFileSync('docs/deployment/evidence/article-product-layout-before-2026-10-23.json', 'utf8'));
const livePath = 'docs/deployment/evidence/article-live-authoring-1792770896872-2026-10-23.json';
const live = JSON.parse(readFileSync(livePath, 'utf8'));
assert.equal(live.acceptance, 'passed');
assert.equal(live.successful_content_writes, 9);
const current = snapshot();
for (const [table, hash] of Object.entries(before.state.hashes)) {
  if (table !== 'audit_events') assert.equal(current.hashes[table], hash, 'Unrelated data changed: '+table);
}
assert.deepEqual(current.health_counts, before.state.health_counts);
const oldCount = before.state.counts.audit_events;
assert.ok(Number.isSafeInteger(oldCount));
const php = `<?php
require '/var/www/vendor/autoload.php';
$app=require '/var/www/bootstrap/app.php';$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
if(posix_geteuid()!==33 || DB::connection()->getDriverName()!=='mysql')throw new RuntimeException('Context refused');
DB::statement('SET TRANSACTION READ ONLY');DB::beginTransaction();
try {
 $old=DB::table('audit_events')->orderBy('id')->limit(${oldCount})->get();
 $new=DB::table('audit_events')->orderBy('id')->offset(${oldCount})->limit(100)->get();
 $counts=[];foreach(['article_catalog_state','article_terms','article_term_versions','articles','article_versions','article_version_terms'] as $t)$counts[$t]=DB::table($t)->count();
 $article=DB::table('articles')->select(['id','public_id','working_version','working_state','published_version','reviewed_version','archived_at'])->sole();
 $versions=DB::table('article_versions')->where('article_id',$article->id)->orderBy('version')->get(['public_id','version','content_hash']);
 echo json_encode(['old_audit_hash'=>hash('sha256',json_encode($old,JSON_THROW_ON_ERROR)),
 'new_audits'=>$new->map(fn($a)=>['actor'=>(int)$a->actor_user_id,'action'=>$a->action,'subject'=>$a->subject_public_id,'outcome'=>$a->outcome,'keys'=>array_keys(json_decode($a->after,true,512,JSON_THROW_ON_ERROR)),'copy_source'=>json_decode($a->after,true,512,JSON_THROW_ON_ERROR)['source_version_id']??null])->all(),
 'counts'=>$counts,'catalog_revision'=>(int)DB::table('article_catalog_state')->where('id',1)->value('revision'),
 'article'=>collect((array)$article)->except('id')->all(),'versions'=>$versions,'writes'=>0],JSON_THROW_ON_ERROR);
} finally { DB::rollBack(); }
`;
const inspected=spawnSync('docker',['exec','-i','--user','33:33','--workdir','/var/www','checkupino_app','php'],{input:php,encoding:'utf8',windowsHide:true,timeout:30000});
assert.equal(inspected.status,0,'Read-only content reconciliation failed');
const content=JSON.parse(inspected.stdout);
assert.equal(content.old_audit_hash,before.state.hashes.audit_events);
assert.equal(content.new_audits.length,9);
const expectedActions={'admin.article_term.created':3,'admin.article.created':1,'admin.article.submitted':1,'admin.article.reviewed':1,'admin.article.published':1,'admin.article.draft_saved':1,'admin.article.version_copied':1};
const actions={};
const safeKeys=new Set(['id','version_id','kind','slug','version','is_active','parent_id','content_hash','working_state','published_version','taxonomy_count','reference_count','source_count','archived','source_version_id']);
for(const a of content.new_audits){
  assert.equal(a.actor,2);assert.equal(a.outcome,'succeeded');
  assert.ok([live.content_id,...Object.values(live.term_ids)].includes(a.subject));
  assert.ok(a.keys.every(k=>safeKeys.has(k)), 'Unexpected audit content key: '+a.keys.join(','));
  actions[a.action]=(actions[a.action]??0)+1;
}
assert.deepEqual(actions,expectedActions);
assert.deepEqual(content.counts,{article_catalog_state:1,article_terms:3,article_term_versions:3,articles:1,article_versions:3,article_version_terms:9});
assert.equal(content.catalog_revision,9);
assert.equal(content.article.public_id,live.content_id);
assert.equal(content.article.working_version,3);assert.equal(content.article.working_state,'draft');
assert.equal(content.article.published_version,1);assert.equal(content.article.reviewed_version,null);assert.equal(content.article.archived_at,null);
assert.deepEqual(content.versions.map(v=>v.version),[1,2,3]);
assert.equal(content.versions[0].content_hash,content.versions[2].content_hash);
assert.notEqual(content.versions[0].content_hash,content.versions[1].content_hash);
assert.equal(content.new_audits.find(a=>a.action==='admin.article.version_copied').copy_source,content.versions[0].public_id);
const services=runtime();assert.equal(services.filter(s=>s.status==='running').length,9);
assert.ok(services.filter(s=>/^checkupino_(scan|content)[-_]/.test(s.name)).every(s=>s.status==='exited'));
assert.equal(services.find(s=>s.name==='checkupino_app').image,'sha256:18eb9257e28f6dc11d59abba7691fe37b1d334a2429ce2be3b5cfb7b1a09f746');
assert.equal(services.find(s=>s.name==='checkupino_prod-admin-1').image,live.image);
assert.equal(docker(['ps','-a','--filter','label=com.docker.compose.project=checkupino_schedule_acceptance','--format','{{.ID}}']).trim(),'');
assert.equal(docker(['network','ls','--filter','label=com.docker.compose.project=checkupino_schedule_acceptance','--format','{{.ID}}']).trim(),'');
const activation=JSON.parse(docker(['exec','--user','33:33','--workdir','/var/www','checkupino_app','php','scripts/content/inspect-activation.php','--expect-enabled']));
const evidence={acceptance:'passed',checked_at:new Date().toISOString(),live_receipt:livePath,content,current_state:current,runtime:services,activation,disposable_project_absent:true,original_audit_prefix_preserved:true,unrelated_fingerprints_preserved:true,writes:0};
const path=`docs/deployment/evidence/article-authoring-closeout-${Date.now()}-2026-10-23.json`;
writeFileSync(path,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({acceptance:'passed',new_audits:content.new_audits.length,old_audits_preserved:oldCount,running_services:9,evidence:path}));
