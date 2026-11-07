import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptedRecommendationSources, recommendationRoot as root, sourceHash } from './source-bindings.mjs';

export function crossMatrix() {
  const matrix = JSON.parse(readFileSync(path.join(root, 'scripts/recommendations/cross-module-cases.json'), 'utf8'));
  const names = ['article_publish_before_rule_publish','rule_publish_before_article_publish','article_archive_before_match','match_before_article_archive',
    'health_save_before_match','match_before_health_save','health_clear_before_match','patient_suspension_before_match','doctor_role_change_before_approval',
    'doctor_unverify_before_approval','doctor_unverify_before_match','doctor_suspension_before_match','grant_revoke_before_match','exact_review_withdraw_before_match',
    'health_audit_rollback_before_match','article_audit_rollback_before_rule_publish'];
  const pairs = [['article_publish','rule_publish'],['rule_publish','article_publish'],['article_archive','match'],['match','article_archive'],
    ['health_save','match'],['match','health_save'],['health_clear','match'],['patient_suspend','match'],['doctor_role_change','approve'],
    ['doctor_unverify','approve'],['doctor_unverify','match'],['doctor_suspend','match'],['grant_revoke','match'],['review_withdraw','match'],
    ['health_save','match'],['article_publish','rule_publish']];
  const outcomes = [['committed','conflict'],['committed','committed'],['committed','unavailable'],['matched','committed'],
    ['committed','no_matches'],['matched','committed'],['committed','insufficient_information'],['committed','forbidden'],
    ['committed','forbidden'],['committed','forbidden'],['committed','unavailable'],['committed','unavailable'],
    ['committed','unavailable'],['committed','unavailable'],['audit_rolled_back','matched'],['audit_rolled_back','committed']];
  assert.deepEqual(matrix.map(item => item.name), names);
  for (const [index, item] of matrix.entries()) {
    assert.ok(Object.keys(item).every(key => ['name','mode','leader','follower','anchor','expected','audits','article_revision','rule_revision','health_versions','reviews','post_state','post_health_reads','audit_failure'].includes(key)));
    assert.deepEqual([item.leader,item.follower],pairs[index]); assert.deepEqual(item.expected,outcomes[index]);
    assert.equal(item.mode,[0,1,15].includes(index) ? 'reviewed' : [8,9].includes(index) ? 'assigned' : 'published');
    assert.equal(item.anchor,[0,1,2,3,15].includes(index) ? 'article' : [4,5,6,7,14].includes(index) ? 'patient' : [8,11].includes(index) ? 'doctor' : [9,10].includes(index) ? 'profile' : 'rule');
    assert.equal(item.audit_failure ?? false,index >= 14);
    for (const key of ['audits','article_revision','rule_revision','health_versions','reviews','post_health_reads']) assert.ok(Number.isInteger(item[key]) && item[key] >= 0 && item[key] <= 2);
    assert.ok(['matched','no_matches','insufficient_information','unavailable','forbidden'].includes(item.post_state));
    assert.equal(item.post_health_reads,['matched','no_matches','insufficient_information'].includes(item.post_state) ? 1 : 0);
  }
  return matrix;
}

export function crossBindings() {
  const accepted = acceptedRecommendationSources();
  crossMatrix();
  const sources = { ...accepted.sources };
  const files = ['scripts/recommendations/CrossModuleFixture.php','scripts/recommendations/CrossModuleIntegrity.php','scripts/recommendations/CrossModuleAnchor.php',
    'scripts/recommendations/cross-module-cases.json','scripts/recommendations/test-cross-source.ps1','scripts/recommendations/cross-source-bindings.mjs',
    'tests/Feature/Database/RecommendationCrossModuleFixtureTest.php','app/Services/AccountStateService.php','app/Services/BrowserSessionRevoker.php',
    'app/Services/AdminIdentityService.php','app/Services/PanelProfileService.php','app/Http/Controllers/Api/Admin/UserController.php',
    'app/Http/Controllers/Api/DoctorProfileController.php','app/Policies/UserPolicy.php','app/Policies/DoctorProfilePolicy.php',
    'app/Models/PatientHealthSnapshot.php','app/Models/PatientBiometricObservation.php','app/Models/AuditEvent.php',
    'config/session.php','config/database.php','config/auth.php','bootstrap/app.php','database/seeders/RolesSeeder.php'];
  for (const directory of ['database/migrations','database/factories','app/Providers']) files.push(...readdirSync(path.join(root,directory)).filter(file => file.endsWith('.php')).map(file => directory + '/' + file));
  for (const file of files) sources[file] = sourceHash(file);
  const ordered = Object.fromEntries(Object.entries(sources).sort(([a],[b]) => a.localeCompare(b)));
  const binding = createHash('sha256').update(JSON.stringify(ordered)).digest('hex');
  return { sources:ordered, binding, receipt:'docs/deployment/evidence/recommendation-cross-source-' + binding + '.json' };
}

export function acceptedCrossSources() {
  const current = crossBindings();
  const receipt = JSON.parse(readFileSync(path.join(root,current.receipt),'utf8'));
  assert.equal(receipt.acceptance,'offline_cross_module_fixtures_passed'); assert.equal(receipt.source_binding,current.binding);
  assert.deepEqual(receipt.sources,current.sources);
  return current;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2),['--record-passed-fixture-gate']);
  const current = crossBindings(), destination = path.join(root,current.receipt);
  if (existsSync(destination)) acceptedCrossSources();
  else {
    mkdirSync(path.dirname(destination),{recursive:true});
    writeFileSync(destination,JSON.stringify({acceptance:'offline_cross_module_fixtures_passed',checked_at:new Date().toISOString(),
      source_binding:current.binding,sources:current.sources,
      scope:'Offline SQLite fixture/serial/constraint/clock protocols only, after successful isolated source gate. No real MySQL contention, live data, clinical approval or activation claim.'},null,2)+'\n',{flag:'wx'});
  }
  console.log(JSON.stringify({fixture_gate:'passed',bindings:Object.keys(current.sources).length,receipt:current.receipt}));
}
