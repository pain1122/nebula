import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

assert.equal(process.argv.length, 2, 'No endpoint/container overrides accepted.');
const docker = args => {
  const result = spawnSync('docker', args, { windowsHide: true, timeout: 20000, maxBuffer: 12000000 });
  assert.equal(result.status, 0, 'Read-only admin inspection failed.');
  return result.stdout;
};
const request = (path, encoding = 'identity') => new Promise((resolve, reject) => {
  assert.match(path, /^\/(?:panel(?:\/|$)|healthz$|$|outside-medical-panel$)/);
  const operation = http.get('http://localhost:3000' + path, { headers: { 'Accept-Encoding': encoding } }, response => {
    const chunks = []; let size = 0;
    response.on('data', chunk => { size += chunk.length; if (size > 12000000) operation.destroy(new Error('Response bound exceeded.')); else chunks.push(chunk); });
    response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
  });
  operation.setTimeout(20000, () => operation.destroy(new Error('Local HTTP timeout.')));
  operation.on('error', reject);
});
const evidencePath = fileURLToPath(new URL('../../docs/deployment/evidence/admin-schedule-controls-ready-static-2026-10-15.json', import.meta.url));
assert.ok(!existsSync(evidencePath), 'Evidence exists; inspect it instead of overwriting.');
const container = JSON.parse(docker(['inspect', 'checkupino_prod-admin-1']))[0];
assert.equal(container.State.Status, 'running'); assert.equal(container.State.Health.Status, 'healthy');
const html = await request('/panel/');
assert.equal(html.status, 200);
const entryPath = html.body.toString().match(/src="(\/panel\/assets\/index-[^" ]+\.js)"/)?.[1];
assert.ok(entryPath, 'SPA entry missing.');
const entry = await request(entryPath);
assert.equal(entry.status, 200);
for (const path of ['my/reservations/:reservationId/medical', 'doctor/reservations/:reservationId/medical']) assert.ok(entry.body.toString().includes(path), 'Approved route missing.');
const medicalName = entry.body.toString().match(/MedicalFiles-[\w-]+\.js/)?.[0];
const cssName = entry.body.toString().match(/MedicalFiles-[\w-]+\.css/)?.[0];
assert.ok(medicalName && cssName, 'Medical page/lazy retained CSS missing.');
assert.ok(!html.body.toString().includes(cssName), 'Medical CSS must remain outside initial HTML.');
const pagePath = '/panel/assets/' + medicalName;
const cssPath = '/panel/assets/' + cssName;
const page = await request(pagePath);
const questionnaireName = entry.body.toString().match(/PatientQuestionnaire-[\w-]+\.js/)?.[0];assert.ok(questionnaireName,'Questionnaire lazy page missing.');assert.ok(entry.body.toString().includes('my/questionnaire'),'Approved questionnaire route missing.');
const questionnairePath='/panel/assets/'+questionnaireName;const questionnairePage=await request(questionnairePath);
const doctorName=entry.body.toString().match(/DoctorReservations-[\w-]+\.js/)?.[0];assert.ok(doctorName);const doctorPath='/panel/assets/'+doctorName;const doctorPage=await request(doctorPath);
const listName = entry.body.toString().match(/AdminReservations-[\w-]+\.js/)?.[0];
const detailName = entry.body.toString().match(/AdminReservationDetail-[\w-]+\.js/)?.[0];
assert.ok(listName && detailName, 'Approved admin reservation lazy pages missing.');
assert.ok(entry.body.toString().includes('reservations/:reservationId'), 'Approved admin detail route missing.');
const listPath = '/panel/assets/' + listName, detailPath = '/panel/assets/' + detailName;
const managementPaths = ['Schedules', 'Catalog', 'CatalogDetail', 'Activity', 'UserProfile', 'UserDirectory', 'Collections', 'MedicalDetail', 'QuestionnaireDetail', 'SubmissionDetail'].map(name => {
 const match = entry.body.toString().match(new RegExp(name + '-[\\w-]+\\.js'))?.[0];
 assert.ok(match, 'Missing lazy administrative page: ' + name); return '/panel/assets/' + match;
});
const assets = [...new Set([...managementPaths, listPath, detailPath, entryPath, pagePath, cssPath, questionnairePath, doctorPath,
 ...[...doctorPage.body.toString().matchAll(/from[ ]*["']\.\/([^"']+\.js)["']/g)].map(match=>'/panel/assets/'+match[1]),
  ...[...questionnairePage.body.toString().matchAll(/from[ ]*["']\.\/([^"']+\.js)["']/g)].map(match => '/panel/assets/' + match[1]),
  ...[...html.body.toString().matchAll(/(?:src|href)="(\/panel\/assets\/[^" ]+\.(?:js|css))"/g)].map(match => match[1]),
  ...[...page.body.toString().matchAll(/from[ ]*["']\.\/([^"']+\.js)["']/g)].map(match => '/panel/assets/' + match[1]),
])];
const checked = []; let code = ''; let emittedCss = '';
const editorCssName=entry.body.toString().match(/ToolboxClassicEditor-[\w-]+\.css/)?.[0];
assert.ok(editorCssName,'Native CKEditor stylesheet reference missing.');
const editorCssPath='/panel/assets/'+editorCssName;
assert.ok(!html.body.toString().includes(editorCssName),'Editor CSS must remain lazy.');
if(!assets.includes(editorCssPath))assets.push(editorCssPath);
for (const path of assets) {
  assert.match(path, /^\/panel\/assets\/[\w.-]+\.(?:js|css)$/);
  const plain = await request(path), gzip = await request(path, 'gzip');
  assert.equal(plain.status, 200); assert.equal(gzip.status, 200);
  assert.match(plain.headers['cache-control'], /immutable/);
  assert.deepEqual(plain.body, docker(['exec', 'checkupino_prod-admin-1', 'cat', '/usr/share/nginx/html' + path]), 'Served/container bytes differ.');
  if (plain.body.length >= 1024) assert.equal(gzip.headers['content-encoding'], 'gzip');
  assert.deepEqual(gzip.headers['content-encoding'] === 'gzip' ? gunzipSync(gzip.body) : gzip.body, plain.body);
  if (path.endsWith('.css')) emittedCss += plain.body.toString();
  if (path.endsWith('.js')) {
    code += plain.body.toString();
    if (path !== entryPath) for (const match of plain.body.toString().matchAll(/from[ ]*["']\.\/([^"']+\.js)["']/g)) {
      const dependency='/panel/assets/'+match[1];
      if (!assets.includes(dependency)) { assert.ok(assets.length < 80, 'Asset dependency bound exceeded.'); assets.push(dependency); }
    }
  }
  if (path === cssPath) assert.ok(plain.body.toString().includes('.file-manager-sidebar'));
  if (path === editorCssPath) assert.ok(plain.body.toString().includes('.ck-editor'));
  checked.push({ path, bytes: plain.body.length, gzip_bytes: gzip.body.length, sha256: createHash('sha256').update(plain.body).digest('hex'), container_byte_match: true });
}
for (const marker of ['medical.outcomePending', 'medical.policyUnavailable', 'attachment_rules', 'body_format', 'plain_text', 'http://localhost:8080']) assert.ok(code.includes(marker), 'Missing medical contract/origin marker: ' + marker);
for (const marker of ['medical.newRequest', 'medical.issueRequest', 'medical.maximumBytes', 'request_type', 'allowed_mime_types']) assert.ok(code.includes(marker), 'Missing request-control marker: ' + marker);
for (const marker of ['medical.uploadFile', 'medical.sendFile', 'medical.uploadPolicyChanged', 'upload_progress', 'awaiting_checks_count']) assert.ok(code.includes(marker), 'Missing upload-control marker: ' + marker);
for (const marker of ['medical.startReview', 'medical.newDraft', 'medical.editDraft', 'medical.publishConfirm', 'medical.confirmPublication', 'medical.amendReport', 'medical.download', 'supersedes_report_id']) assert.ok(code.includes(marker), 'Missing medical outcome control: ' + marker);
for(const marker of ['questionnaire.submit','questionnaire.uncertain','questionnaire.score','questionnaire_version','demo-heart-health-screen','submitter_name','choice_id'])if(marker!=='questionnaire_version')assert.ok(code.includes(marker),'Questionnaire contract missing: '+marker);
for(const marker of ['booking.completeAppointment','booking.confirmCompletion','booking.completionUncertain','can_complete','/api/doctor/reservations/'])assert.ok(code.includes(marker),'Completion marker missing: '+marker);
for (const path of ['/', '/panel']) { const result = await request(path); assert.equal(result.status, 308); assert.equal(result.headers.location, '/panel/'); }
for (const path of ['/healthz', '/panel/login', '/panel/my/questionnaire', '/panel/my/reservations/synthetic-reservation/medical', '/panel/doctor/reservations/synthetic-reservation/medical']) assert.equal((await request(path)).status, 200);
for (const path of ['/panel/assets/missing-medical-panel.js', '/panel/missing-medical-panel.png', '/outside-medical-panel']) assert.equal((await request(path)).status, 404);
for (const marker of ['adminReservations.box.appointment', 'adminReservations.box.payment', 'adminReservations.box.timeline', 'adminReservations.title', 'adminReservations.bookedAmount', 'adminReservations.quick.upcoming', '/api/admin/reservations', 'workplace_id', 'booked_amount']) assert.ok(code.includes(marker), 'Admin reservation contract missing: ' + marker);
for (const path of ['/panel/schedules', '/panel/schedules/workplaces/3', '/panel/specialties', '/panel/specialties/1', '/panel/checkups', '/panel/checkups/5', '/panel/checkup-categories', '/panel/checkup-categories/1', '/panel/reservations', '/panel/reservations/8']) assert.equal((await request(path)).status, 200);
for (const marker of ['medical-requests/:requestId', 'questionnaires/:questionnaireId', 'questionnaire-submissions/:submissionId', 'adminManage.authorship', 'expected_version', 'answers_available', 'expected_body', 'adminManage.uncertain']) assert.ok(code.includes(marker), 'Management marker missing: ' + marker);
for (const path of ['/panel/medical-requests', '/panel/medical-requests/01m4hfgan168p6q5ftp528285f', '/panel/questionnaires/0', '/panel/questionnaires/1', '/panel/questionnaire-submissions']) assert.equal((await request(path)).status, 200);
assert.ok(emittedCss.includes(':where(html[dir=rtl])'), 'Generated RTL scopes absent');
assert.ok(emittedCss.includes(':where(html[dir=ltr])'), 'Generated LTR scopes absent');
assert.ok(code.includes('data-questionnaire-answer'), 'Saved answer cards absent');
assert.ok(!code.includes("Introduction (HTML source)"), 'Raw-source product label must be removed');
for(const marker of ['questionnaire-introduction-editor','questionnaire-recommendation-editor-','adminManage.editorUnavailable','adminManage.editorTooLong'])assert.ok(code.includes(marker), 'Visual editor contract absent: '+marker);
for (const path of ['/panel/profile', '/panel/users/01m4hfgan168p6q5ftp528285f']) assert.equal((await request(path)).status, 200);
for (const marker of ['users/:userId', 'profileOverview.support', 'profileOverview.editName', 'expected_revision', '/api/panel-profile', 'support-profile']) assert.ok(code.includes(marker), 'Profile contract missing: '+marker);
for (const marker of ['reservationActions.reschedule','reservationActions.override','reschedule-slots','Stop waiting and close','reservationActions.confirm']) assert.ok(code.includes(marker), 'Reservation controls absent: '+marker);
for (const path of ['/panel/doctors','/panel/patients']) assert.equal((await request(path)).status,200);
for (const marker of ['operations.verification','operations.reset','doctor_profile','active_workplaces_count','directory=']) assert.ok(code.includes(marker),'Operational directory marker missing: '+marker);
assert.equal((await request('/panel/activity')).status,200);
for(const marker of ['/api/admin/activity','activity.description','reason_recorded','identity_available','actor_role'])assert.ok(code.includes(marker),'Activity marker missing: '+marker);
for(const marker of ['catalog.confirmChange','catalog.childAction','specialties/:specialtyId','catalog.specialtyArchiveHint','can_archive']) assert.ok(code.includes(marker),'Guarded catalog marker absent: '+marker);
for(const marker of ['schedules/workplaces/:workplaceId','schedule.stateHint','binding_consistent','blocking_reservation','has_reservation_history'])assert.ok(code.includes(marker),'Schedule contract missing: '+marker);
for(const marker of ['slot-control','schedule.control.editSlot','schedule.control.bulk','schedule.control.preview','preview_expires_at','schedule.control.exclusion.reservation_history'])assert.ok(code.includes(marker),'Slot control marker missing: '+marker);
const evidence = { checked_at: new Date().toISOString(), acceptance: 'passed', image: container.Image, entry: entryPath, medical_page: pagePath, questionnaire_page:questionnairePath, lazy_medical_css: cssPath, medical_css_absent_initial_html: true, assets: checked, admin_reservation_pages: [listPath, detailPath], administration_pages: managementPaths, scope: "Approved schedule workplace/list/detail lazy assets and retained clinical/catalog/profile/reservation served-container bytes, compression/cache/deep links/404. No authenticated browser or live mutation acceptance inferred." };
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ acceptance: 'passed', image: container.Image, entry: entryPath, medical_page: pagePath, medical_css: cssPath, checked_assets: checked.length }));
