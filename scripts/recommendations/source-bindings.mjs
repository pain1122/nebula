import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const recommendationRoot = fileURLToPath(new URL('../../', import.meta.url));
export const sourceHash = file => createHash('sha256').update(readFileSync(path.join(recommendationRoot, file))).digest('hex');
export function recommendationBindings() {
  const files = [
    'app/Http/Controllers/Api/RecommendationController.php', 'app/Services/AuditLogger.php', 'routes/api.php',
    'app/Models/RecommendationRule.php', 'app/Models/RecommendationRuleVersion.php', 'app/Models/RecommendationRuleReview.php',
    'app/Models/RecommendationReviewerGrant.php', 'app/Models/User.php', 'app/Models/DoctorProfile.php',
    'config/recommendations.php', 'config/article_content.php', 'config/patient_health.php',
    'database/migrations/2026_11_05_000001_create_recommendation_rule_tables.php',
    'tests/Feature/Database/RecommendationSchemaTest.php', 'tests/Feature/Api/RecommendationTest.php',
    'tests/Unit/Recommendations/RulePredicateTest.php', 'tests/Support/IsolatedArticleApplication.php',
    'scripts/recommendations/test-source.ps1', 'scripts/recommendations/source-bindings.mjs', 'composer.json', 'composer.lock', 'phpunit.xml',
  ];
  for (const directory of ['app/Services/Recommendations', 'app/Services/Content', 'app/Services/Health']) {
    files.push(...readdirSync(path.join(recommendationRoot, directory)).filter(file => file.endsWith('.php')).map(file => directory + '/' + file));
  }
  const sources = Object.fromEntries([...new Set(files)].sort().map(file => [file, sourceHash(file)]));
  const binding = createHash('sha256').update(JSON.stringify(sources)).digest('hex');
  const receipt = 'docs/deployment/evidence/recommendation-source-' + binding + '.json';
  return { sources, binding, receipt };
}
export function acceptedRecommendationSources() {
  const current = recommendationBindings();
  const receipt = JSON.parse(readFileSync(path.join(recommendationRoot, current.receipt), 'utf8'));
  assert.equal(receipt.acceptance, 'php_source_and_article_regression_passed');
  assert.equal(receipt.source_binding, current.binding);
  assert.deepEqual(receipt.sources, current.sources);
  return current;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--record-passed-php-gate']);
  const current = recommendationBindings();
  const destination = path.join(recommendationRoot, current.receipt);
  if (existsSync(destination)) acceptedRecommendationSources();
  else {
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, JSON.stringify({ acceptance: 'php_source_and_article_regression_passed', checked_at: new Date().toISOString(),
      source_binding: current.binding, sources: current.sources,
      scope: 'Recorded only after successful isolated PHP recommendation plus affected article source gate. No MySQL, actual clinical review, activation or served acceptance claim.' }, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ source_gate: 'passed', receipt: current.receipt, bindings: Object.keys(current.sources).length }));
}
