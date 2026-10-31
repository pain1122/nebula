import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import directionMirror, { mirrorDeclaration } from '../../frontend/scripts/direction-mirror.mjs';

// Reuse Vite's declared, installed PostCSS dependency without changing either package manifest.
const requireVite=createRequire(new URL('../../frontend/node_modules/vite/package.json',import.meta.url));
const postcss=requireVite('postcss');
const mirror=(prop,value)=>mirrorDeclaration(prop,value,postcss.list);
for(const [prop,input,expectedProp,expected] of [
  ['margin-left','auto','margin-right','auto'],['left','calc(100% - 24px)','right','calc(100% - 24px)'],
  ['padding','1px 2px 3px 4px','padding','1px 4px 3px 2px'],
  ['margin','1px 2px','margin','1px 2px'],['inset','1px 2px 3px 4px','inset','1px 4px 3px 2px'],
  ['border-color','red green blue yellow','border-color','red yellow blue green'],
  ['border-top-left-radius','4px','border-top-right-radius','4px'],
  ['border-radius','1px 2px 3px 4px / 5px 6px 7px 8px','border-radius','2px 1px 4px 3px / 6px 5px 8px 7px'],
  ['float','left','float','right'],['text-align','right','text-align','left'],
  ['margin-inline-start','2rem','margin-inline-start','2rem'],
  ['transform','translateX(-100%)','transform','translateX(100%)'],
  ['transform','translate(10px, 20px) rotate(90deg)','transform','translate(-10px, 20px) rotate(-90deg)'],
  ['transform','translateX(calc(var(--width) + 10px))','transform','translateX(calc(-1 * (calc(var(--width) + 10px))))'],
  ['transform','matrix(1, 2, 3, 4, 5, 6)','transform','matrix(1, -2, -3, 4, -5, 6)'],
  ['box-shadow','2px 3px 4px red, inset -5px 6px 7px blue','box-shadow','-2px 3px 4px red, inset 5px 6px 7px blue'],
  ['background-position','25% center','background-position','75% center'],
  ['background-position','right 12px center','background-position','left 12px center'],
  ['background-image','url("/images/logo-right.svg")','background-image','url("/images/logo-right.svg")'],
  ['background-image','linear-gradient(90deg, red, blue)','background-image','linear-gradient(-90deg, red, blue)'],
]) test(`${prop}: ${input}`,()=>assert.deepEqual(mirror(prop,input),{prop:expectedProp,value:expected}));

test('root attributes match the root itself and scope has zero added specificity',()=>{
  const result=postcss([directionMirror()]).process('[data-layout="vertical"] .main-content{margin-left:250px} :root{--surface:linear-gradient(to right,red,blue)}',{from:undefined});
  assert.match(result.css,/\[data-layout="vertical"\]:where\(html\[dir="rtl"\]\)/);
  assert.match(result.css,/:root:where\(html\[dir="rtl"\]\)/);
  assert.match(result.css,/margin-right:250px/);
});
test('whole declaration order survives shorthand resets without override hacks',()=>{
  const root=postcss([directionMirror()]).process('.x{padding-left:5px;padding:0}.y{padding:0;padding-left:5px}',{from:undefined}).root;
  const rules=[];root.walkRules(r=>{if(r.selector.includes('dir="rtl"'))rules.push(r.nodes.filter(n=>n.type==='decl').map(d=>d.prop+':'+d.value));});
  assert.deepEqual(rules,[['padding-right:5px','padding:0'],['padding:0','padding-right:5px']]);
});
test('paired directional glyphs change only their own icon, not unrelated font codepoints',()=>{
  const css=postcss([directionMirror()]).process('.ri-arrow-left:before{content:"\\e001"}.ri-arrow-right:before{content:"\\e002"}.other-font-logo:before{content:"\\e001"}',{from:undefined}).css;
  assert.match(css,/dir="rtl"[^}]*\.ri-arrow-left[^}]*content:"\\e002"/);
  assert.match(css,/\.other-font-logo:before\{content:"\\e001"\}/);
});
test('directional keyframes are cloned and only RTL animation references change',()=>{
  const css=postcss([directionMirror()]).process('.x{animation:slide .3s ease}@keyframes slide{from{transform:translateX(100%)}to{transform:translateX(0)}}',{from:undefined}).css;
  assert.match(css,/animation:slide--panel-rtl/);assert.match(css,/@keyframes slide--panel-rtl/);assert.match(css,/translateX\(-100%\)/);
});
test('legacy RTL compensations are removed and LTR remains the authority',()=>{
  const css=postcss([directionMirror()]).process('.x{left:1px}[dir="rtl"] .x{right:99px}',{from:undefined}).css;
  assert.ok(!css.includes('99px'));assert.match(css,/right:1px/);
});
test('existing encoded carousel arrow artwork is swapped, logos remain untouched',()=>{
  const css=postcss([directionMirror()]).process('.carousel-control-prev-icon{background-image:url("prev.svg")}.carousel-control-next-icon{background-image:url("next.svg")}.logo{background-image:url("brand-right.svg")}',{from:undefined}).css;
  assert.match(css,/dir="rtl"[^}]*\.carousel-control-prev-icon[^}]*url\("next.svg"\)/);
  assert.match(css,/\.logo\{background-image:url\("brand-right.svg"\)\}/);
});
test('native editor formats, code and runtime-owned slider/calendar geometry stay intact',()=>{
  const input='.ql-editor .ql-direction-rtl{text-align:right;direction:rtl}.swiper-rtl .swiper-slide{transform:translateX(30px)}.fc-direction-rtl{direction:rtl;text-align:right}pre{direction:ltr;text-align:left}';
  const result=postcss([directionMirror()]).process(input,{from:undefined});
  assert.equal(result.css,input);assert.equal(result.messages[0].nativeRules,4);
});
test('breadcrumb fallback uses its own Material Design Icons pair and harmless background-clip is not a gap',()=>{
  const input='.mdi-chevron-left:before{content:"\\F0141"}.mdi-chevron-right:before{content:"\\F0142"}.breadcrumb-item+.breadcrumb-item:before{content:var(--vz-breadcrumb-divider,"\\f0142");float:left}.x{background-clip:padding-box}';
  const result=postcss([directionMirror()]).process(input,{from:undefined});
  assert.match(result.css,/dir="rtl"[^}]*breadcrumb-item[^}]*content:var\(--vz-breadcrumb-divider,"\\F0141"\)/);
  assert.deepEqual(result.messages[0].unsupported,[]);
});
test('object position mirrors the horizontal percentage while preserving its vertical coordinate',()=>{
  assert.deepEqual(mirror('object-position','10% 20%'),{prop:'object-position',value:'90% 20%'});
});
test('the installed CKEditor stylesheet retains its complete native LTR/RTL/content rules',()=>{
  const input='.ck[dir="rtl"]{direction:rtl;right:4px}.ck-content .text-right{text-align:right}.ck[dir="ltr"]{left:4px}';
  const result=postcss([directionMirror()]).process(input,{from:'C:/project/frontend/node_modules/ckeditor5/dist/ckeditor5.css'});
  assert.equal(result.css,input);assert.equal(result.messages[0].nativeStylesheet,'ckeditor5');
});
