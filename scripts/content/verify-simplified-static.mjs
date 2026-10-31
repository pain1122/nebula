import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import http from 'node:http';
import { gunzipSync } from 'node:zlib';
import { runtime } from '../health/activation-state.mjs';

assert.equal(process.argv.length,2);
const request=(path,encoding='identity')=>new Promise((resolve,reject)=>{
 assert.match(path,/^\/(?:panel(?:\/|$)|healthz$)/);
 const req=http.get('http://localhost:3000'+path,{headers:{'Accept-Encoding':encoding}},r=>{const chunks=[];let bytes=0;r.on('data',chunk=>{bytes+=chunk.length;if(bytes>12000000)req.destroy(new Error('Asset bound exceeded'));else chunks.push(chunk);});r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body:Buffer.concat(chunks)}));});req.setTimeout(20000,()=>req.destroy(new Error('HTTP timeout')));req.on('error',reject);
});
const container=runtime().find(s=>s.name==='checkupino_prod-admin-1');assert.equal(container.status,'running');assert.equal(container.health,'healthy');
const html=await request('/panel/');assert.equal(html.status,200);
const assets=[...html.body.toString().matchAll(/(?:src|href)="(\/panel\/assets\/[\w.-]+\.(?:js|css))"/g)].map(m=>m[1]);assert.ok(assets.some(p=>/index-.*\.js$/.test(p)));
const entryPath=assets.find(p=>/index-.*\.js$/.test(p));
const checked=[];let code='';
for(const path of assets){
 assert.ok(assets.length<=120,'Dependency graph bound');
 const plain=await request(path),compressed=await request(path,'gzip');assert.equal(plain.status,200);assert.equal(compressed.status,200);assert.match(plain.headers['cache-control'],/immutable/);
 const result=spawnSync('docker',['exec','checkupino_prod-admin-1','cat','/usr/share/nginx/html'+path],{windowsHide:true,timeout:10000,maxBuffer:12000000});assert.equal(result.status,0);assert.deepEqual(plain.body,result.stdout);assert.deepEqual(compressed.headers['content-encoding']==='gzip'?gunzipSync(compressed.body):compressed.body,plain.body);
 if(path.endsWith('.js')){const text=plain.body.toString();code+=text;for(const m of text.matchAll(/(?:assets\/)?((?:Articles|ArticleEditor)-[\w-]+\.css)/g)){const next='/panel/assets/'+m[1];if(!assets.includes(next))assets.push(next);}if(path===entryPath){for(const prefix of ['UserProfile','Articles','Taxonomies']){const chunk=text.match(new RegExp(prefix+'-[\\w-]+\\.js'))?.[0];assert.ok(chunk,'Missing lazy chunk '+prefix);assets.push('/panel/assets/'+chunk);}}for(const m of text.matchAll(/(?:from|import)\s*["']\.\/([\w.-]+\.(?:js|css))["']/g)){const next='/panel/assets/'+m[1];if(!assets.includes(next))assets.push(next);}}
 checked.push({path,bytes:plain.body.length,sha256:createHash('sha256').update(plain.body).digest('hex'),container_byte_match:true,compression_equivalent:true});
}
for(const marker of ['content.previewDraft','content.sharedTermsHint','/api/my/health-profile','patient-health','/api/admin/articles','/api/admin/article-taxonomies','content.recoveryNotice','content.confirmChange','article-body-','content.seo.heading','article-seo-'])assert.ok(code.includes(marker),'Missing health marker '+marker);
for(const path of ['/healthz','/panel/profile','/panel/login','/panel/articles','/panel/articles/new','/panel/articles/01j00000000000000000000001','/panel/article-taxonomies'])assert.equal((await request(path)).status,200);
assert.equal((await request('/panel/assets/nonexistent-health-file.js')).status,404);
const evidence={acceptance:'passed',checked_at:new Date().toISOString(),image:container.image,assets:checked,scope:'Article candidate served/container bytes, immutable cache, compression, lazy dependency graph, approved content/profile/login deep links and asset404; authenticated acceptance recorded separately.'};
writeFileSync(`docs/deployment/evidence/article-simplification-static-${Date.now()}-2026-10-23.json`,JSON.stringify(evidence,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({acceptance:'passed',image:container.image,assets:checked.length}));
