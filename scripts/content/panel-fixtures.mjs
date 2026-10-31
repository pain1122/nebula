// Browser-only synthetic responses. Never imported by application/runtime code.
export const id = '01j00000000000000000000001';
export const oldId = '01j00000000000000000000002';
export const versionId = '01j00000000000000000000003';
export const termId = '01j00000000000000000000004';
const actor = { id: '01j00000000000000000000009', name: 'Synthetic editor' };
const clock = '2026-10-23 12:00:00';
export const revision = 'a'.repeat(64);
export const term = { id: termId, version_id: oldId, kind: 'category', slug: 'synthetic-care', version: 1, labels: { en: 'Synthetic care', fa: 'مراقبت آزمایشی' }, descriptions: {}, is_active: true, parent_id: null, actor, recorded_at: clock };
export const version = number => ({ id: number === 1 ? oldId : versionId, version: number, schema_version: 1, translations: { en: { title: number === 1 ? 'Original article' : 'Synthetic article', summary: 'Educational content preview', body_html: '<p>Safe synthetic content.</p>' }, fa: { title: number === 1 ? 'مقاله اصلی' : 'مقاله آزمایشی', summary: 'پیش‌نمایش محتوای آموزشی', body_html: '<p>محتوای امن آزمایشی</p>' } }, health_catalog_version: 'health-2026-10-22.1', health_references: [], source_links: [{ url: 'https://example.test/source', label: 'Synthetic source' }], taxonomy: [term], content_hash: String(number).repeat(64), publishable_languages: ['en', 'fa'], actor, recorded_at: clock });
export const article = { id, slug: 'synthetic-article', author: actor, working_state: 'draft', status: 'published_with_draft', has_unpublished_changes: true, working: version(2), published: version(1), review: null, created_at: clock, updated_at: clock, archived_at: null };
const envelope = data => ({ success: true, data, meta: { read_only: true, revision, catalog_revision: 1 } });
const page = data => ({ ...envelope(data), meta: { ...envelope(data).meta, pagination: { current_page: 1, last_page: 1, per_page: 20, total: data.length } } });
export function fixture(url) {
  const path = url.pathname;
  if (path.endsWith('/write-context')) {
    const creating = /\/(articles|article-taxonomies)\/write-context$/.test(path);
    return envelope(path.includes('article-taxonomies') ? { id: creating ? null : termId, current: creating ? null : term, revision, catalog_revision: 1, can_create: creating, can_update: !creating, can_retire: !creating } : { id: creating ? null : id, current: creating ? null : article, revision, catalog_revision: 1, can_create: creating, can_update: !creating, can_edit_slug: creating, health_catalog: { version: 'health-2026-10-22.1', terms: [{ id: 'condition.diabetes', kind: 'condition', labels: { en: 'Diabetes', fa: 'دیابت' }, active: true }] } });
  }
  if (path.endsWith('/action-context')) return envelope({ action: url.searchParams.get('action'), current: article, source: url.searchParams.get('source_version_id') ? version(1) : null, eligible: true, blockers: [], review_kind: 'editorial', catalog_revision: 1, revision });
  if (path.endsWith('/events')) return page([{ id: oldId, action: 'admin.article.version_copied', actor, before: { version: 1, working_state: 'draft', published_version: 1 }, after: { version: 2, working_state: 'draft', published_version: 1, source_version_id: oldId }, recorded_at: clock, kind: 'editorial' }]);
  if (path.endsWith('/versions')) return page(path.includes('article-taxonomies') ? [term, { ...term, version_id: versionId, version: 2 }] : [version(2), version(1)]);
  if (path.includes('/versions/')) return envelope(version(1));
  if (path === '/api/admin/articles') return page([article]);
  if (path === '/api/admin/article-taxonomies') return page([term]);
  return envelope(path.includes('article-taxonomies') ? term : article);
}
