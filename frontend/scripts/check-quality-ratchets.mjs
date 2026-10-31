import { builtinModules } from "node:module";
import { spawnSync } from "node:child_process";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const sourceExtensions = new Set([".ts", ".tsx"]);
const resolvableExtensions = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".css",
  ".scss",
  ".sass",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
];

const normalize = (value) => value.split(path.sep).join("/");

const fail = (message) => {
  throw new Error(message);
};

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(target)));
    } else {
      files.push(target);
    }
  }

  return files;
};

const sourceFiles = (await walk(sourceRoot)).filter((file) =>
  sourceExtensions.has(path.extname(file)),
);
const packageJson = await readJson("package.json");
const tsconfig = await readJson("tsconfig.json");
const debt = await readJson("type-debt.json");
const approvedFormDependencies = {
  "@hookform/resolvers": "5.9.1",
  "react-hook-form": "7.86.0",
  zod: "4.4.3",
};
for (const [dependency, expectedVersion] of Object.entries(approvedFormDependencies)) {
  if (packageJson.dependencies?.[dependency] !== expectedVersion) {
    fail(`${dependency} must remain exactly pinned to ${expectedVersion} during F17`);
  }
}
const approvedTableVersion = "9.2.3";
if (packageJson.dependencies?.["@tanstack/react-table"] !== approvedTableVersion) {
  fail(`@tanstack/react-table must remain exactly pinned to ${approvedTableVersion} during F19`);
}
const approvedSwiperVersion = "14.2.0";
if (packageJson.dependencies?.swiper !== approvedSwiperVersion) {
  fail(`swiper must remain exactly pinned to ${approvedSwiperVersion} after F26`);
}
const approvedRouterVersion = "7.18.3";
if (packageJson.dependencies?.["react-router-dom"] !== approvedRouterVersion) {
  fail(`react-router-dom must remain exactly pinned to ${approvedRouterVersion} after F25`);
}
const approvedCkeditorVersion = "48.5.0";
const approvedCkeditorReactVersion = "11.2.0";
if (
  packageJson.dependencies?.ckeditor5 !== approvedCkeditorVersion ||
  packageJson.dependencies?.["@ckeditor/ckeditor5-react"] !== approvedCkeditorReactVersion
) {
  fail("the approved modular CKEditor 5 packages are no longer pinned exactly");
}
if (packageJson.dependencies?.["@ckeditor/ckeditor5-build-classic"] !== undefined) {
  fail("the retired CKEditor predefined build must not return");
}
const approvedEchartsVersion = "6.1.0";
const approvedEchartsReactVersion = "3.0.6";
if (
  packageJson.dependencies?.echarts !== approvedEchartsVersion ||
  packageJson.dependencies?.["echarts-for-react"] !== approvedEchartsReactVersion
) {
  fail("the approved ECharts 6 compatibility pair is no longer pinned exactly");
}
if (packageJson.dependencies?.["react-scrollspy"] !== undefined) {
  fail("the deprecated react-scrollspy package must not return");
}
const approvedMomentVersion = "2.30.1";
if (packageJson.dependencies?.moment !== approvedMomentVersion) {
  fail(`retained Moment must remain exactly pinned to ${approvedMomentVersion}`);
}
for (const retiredTableDependency of ["react-table", "@types/react-table"]) {
  if (
    packageJson.dependencies?.[retiredTableDependency] !== undefined ||
    packageJson.devDependencies?.[retiredTableDependency] !== undefined
  ) {
    fail(`retired table dependency returned: ${retiredTableDependency}`);
  }
}
const approvedDirectLegacyDependencies = {
  classnames: "2.5.1",
  lodash: "4.18.1",
  nouislider: "14.7.0",
  "prop-types": "15.8.1",
};
for (const [dependency, expectedVersion] of Object.entries(approvedDirectLegacyDependencies)) {
  if (packageJson.dependencies?.[dependency] !== expectedVersion) {
    fail(
      `retained runtime dependency must remain exactly declared: ${dependency}@${expectedVersion}`,
    );
  }
}
const packageLock = await readJson("package-lock.json");
if (
  packageLock.packages?.["node_modules/@tanstack/react-table"]?.version !== approvedTableVersion
) {
  fail(`the lock must resolve @tanstack/react-table ${approvedTableVersion}`);
}
if (packageLock.packages?.["node_modules/swiper"]?.version !== approvedSwiperVersion) {
  fail(`the lock must resolve swiper ${approvedSwiperVersion}`);
}
if (
  packageLock.packages?.["node_modules/react-router-dom"]?.version !== approvedRouterVersion ||
  packageLock.packages?.["node_modules/react-router"]?.version !== approvedRouterVersion
) {
  fail(`the lock must resolve the React Router family at ${approvedRouterVersion}`);
}
if (
  packageLock.packages?.["node_modules/ckeditor5"]?.version !== approvedCkeditorVersion ||
  packageLock.packages?.["node_modules/@ckeditor/ckeditor5-react"]?.version !==
    approvedCkeditorReactVersion ||
  packageLock.packages?.["node_modules/@ckeditor/ckeditor5-build-classic"] !== undefined
) {
  fail("the lock no longer resolves the approved modular CKEditor packages");
}
for (const [packagePath, metadata] of Object.entries(packageLock.packages ?? {})) {
  if (
    /^node_modules\/@ckeditor\/ckeditor5-(?!react$|integrations-common$)[^/]+$/.test(packagePath) &&
    metadata.version !== approvedCkeditorVersion
  ) {
    fail(`${packagePath} must remain aligned at CKEditor ${approvedCkeditorVersion}`);
  }
}
if (packageLock.packages?.["node_modules/lodash-es"]?.version !== "4.18.1") {
  fail("lodash-es must remain on the audited 4.18.1 resolution");
}
if (
  packageLock.packages?.["node_modules/echarts"]?.version !== approvedEchartsVersion ||
  packageLock.packages?.["node_modules/echarts-for-react"]?.version !==
    approvedEchartsReactVersion ||
  packageLock.packages?.["node_modules/zrender"]?.version !== approvedEchartsVersion
) {
  fail("the lock no longer resolves the approved ECharts 6 family");
}
if (packageLock.packages?.["node_modules/react-scrollspy"] !== undefined) {
  fail("the lock must not resolve the removed react-scrollspy package");
}
if (packageLock.packages?.["node_modules/moment"]?.version !== approvedMomentVersion) {
  fail(`the lock must resolve retained Moment ${approvedMomentVersion}`);
}
for (const retiredTablePackage of ["node_modules/react-table", "node_modules/@types/react-table"]) {
  if (packageLock.packages?.[retiredTablePackage] !== undefined) {
    fail(`retired table lock entry returned: ${retiredTablePackage}`);
  }
}
for (const [dependency, expectedVersion] of Object.entries(approvedDirectLegacyDependencies)) {
  if (packageLock.packages?.[`node_modules/${dependency}`]?.version !== expectedVersion) {
    fail(`retained runtime lock must resolve ${dependency}@${expectedVersion}`);
  }
}
const sourceTexts = new Map(
  await Promise.all(sourceFiles.map(async (file) => [file, await readFile(file, "utf8")])),
);

const ckeditorAdapterPath = "src/Components/Common/ToolboxClassicEditor.tsx";
const ckeditorProductionOwners = [...sourceTexts.entries()]
  .filter(([, sourceText]) =>
    /from\s+["'](?:@ckeditor\/ckeditor5-react|ckeditor5)["']/.test(sourceText),
  )
  .filter(([file]) => !/\.(?:test|spec)\.[^.]+$/.test(file))
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (JSON.stringify(ckeditorProductionOwners) !== JSON.stringify([ckeditorAdapterPath])) {
  fail(`modular CKEditor ownership changed: ${JSON.stringify(ckeditorProductionOwners)}`);
}
const ckeditorAdapterSource =
  sourceTexts.get(path.join(sourceRoot, "Components", "Common", "ToolboxClassicEditor.tsx")) ?? "";
for (const marker of ['licenseKey: "GPL"', 'import "ckeditor5/ckeditor5.css"']) {
  if (!ckeditorAdapterSource.includes(marker)) {
    fail(`the approved GPL CKEditor adapter contract changed: ${marker}`);
  }
}
for (const consumer of [
  "pages/Forms/FormEditor/FormEditor.tsx",
  "pages/Ecommerce/EcommerceProducts/EcommerceAddProduct.tsx",
  "pages/EmailInbox/EmailToolbar.tsx",
  "pages/EmailInbox/EmailSidebar.tsx",
  "pages/Projects/CreateProject/index.tsx",
]) {
  const consumerSource = sourceTexts.get(path.join(sourceRoot, ...consumer.split("/"))) ?? "";
  if (!consumerSource.includes("ToolboxClassicEditor")) {
    fail(`retained CKEditor consumer bypassed the approved adapter: ${consumer}`);
  }
}
for (const [file, sourceText] of sourceTexts) {
  if (sourceText.includes("@ckeditor/ckeditor5-build-classic")) {
    fail(
      `retired CKEditor predefined build import returned: ${normalize(path.relative(root, file))}`,
    );
  }
}

const echartsAdapterPath = "src/Components/Common/VelzonEChart.tsx";
const echartsWrapperOwners = [...sourceTexts.entries()]
  .filter(([, sourceText]) => /from\s+["']echarts-for-react["']/.test(sourceText))
  .filter(([file]) => !/\.(?:test|spec)\.[^.]+$/.test(file))
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (JSON.stringify(echartsWrapperOwners) !== JSON.stringify([echartsAdapterPath])) {
  fail(`ECharts React wrapper ownership changed: ${JSON.stringify(echartsWrapperOwners)}`);
}
const echartsAdapterSource =
  sourceTexts.get(path.join(sourceRoot, "Components", "Common", "VelzonEChart.tsx")) ?? "";
for (const marker of [
  'import "echarts/theme/v5.js"',
  'import "../../assets/scss/plugins/_echarts.scss"',
  'theme="v5"',
]) {
  if (!echartsAdapterSource.includes(marker)) {
    fail(`the Velzon ECharts 6 appearance contract changed: ${marker}`);
  }
}
const retainedEchartsPageSource =
  sourceTexts.get(path.join(sourceRoot, "pages", "Charts", "ECharts", "ECharts.tsx")) ?? "";
for (const marker of ["Components/Common/VelzonEChart", "richInheritPlainLabel: false"]) {
  if (!retainedEchartsPageSource.includes(marker)) {
    fail(`the retained ECharts 6 compatibility contract changed: ${marker}`);
  }
}

const scrollspyConsumers = [...sourceTexts.entries()]
  .filter(([, sourceText]) => sourceText.includes("Components/Common/VelzonScrollspy"))
  .filter(([file]) => !/\.(?:test|spec)\.[^.]+$/.test(file))
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
const approvedScrollspyConsumers = [
  "src/pages/Job_Landing/Job/Navbar.tsx",
  "src/pages/Landing/NFTLanding/Navbar.tsx",
  "src/pages/Landing/OnePage/navbar.tsx",
];
if (JSON.stringify(scrollspyConsumers) !== JSON.stringify(approvedScrollspyConsumers)) {
  fail(`retained scrollspy consumers changed: ${JSON.stringify(scrollspyConsumers)}`);
}
const scrollspyAdapterSource =
  sourceTexts.get(path.join(sourceRoot, "Components", "Common", "VelzonScrollspy.tsx")) ?? "";
for (const marker of [
  'window.addEventListener("scroll"',
  'window.removeEventListener("scroll"',
  "requestAnimationFrame(updateActiveItem)",
  "React.cloneElement",
]) {
  if (!scrollspyAdapterSource.includes(marker)) {
    fail(`the retained scrollspy compatibility contract changed: ${marker}`);
  }
}
for (const [file, sourceText] of sourceTexts) {
  if (
    sourceText.includes('from "react-scrollspy"') ||
    sourceText.includes("from 'react-scrollspy'")
  ) {
    fail(`deprecated react-scrollspy import returned: ${normalize(path.relative(root, file))}`);
  }
}

const momentOwners = [...sourceTexts.entries()]
  .filter(([, sourceText]) => /from\s+["']moment["']/.test(sourceText))
  .filter(([file]) => !/\.(?:test|spec)\.[^.]+$/.test(file))
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (momentOwners.length !== 17 || momentOwners.some((file) => !file.startsWith("src/pages/"))) {
  fail(`retained Moment ownership changed: ${JSON.stringify(momentOwners)}`);
}
for (const [file, sourceText] of sourceTexts) {
  if (/from\s+["']moment\/locale\//.test(sourceText)) {
    fail(`unbounded Moment locale import returned: ${normalize(path.relative(root, file))}`);
  }
}

const productTableProductionSources = [...sourceTexts.entries()].filter(
  ([file]) =>
    normalize(path.relative(sourceRoot, file)).startsWith("modules/checkupino/table/") &&
    !/\.(?:test|spec)\.[^.]+$/.test(file),
);
const nativeProductTableOwners = productTableProductionSources
  .filter(([, sourceText]) => /from\s+["']@tanstack\/react-table["']/.test(sourceText))
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(nativeProductTableOwners) !==
  JSON.stringify(["src/modules/checkupino/table/ServerDataTable.tsx"])
) {
  fail(`native product table ownership changed: ${JSON.stringify(nativeProductTableOwners)}`);
}
for (const [file, sourceText] of productTableProductionSources) {
  if (
    /@tanstack\/react-table\/legacy|from\s+["']react-table["']/.test(sourceText) ||
    /\bcreate(?:Filtered|Paginated|Sorted)RowModel\b/.test(sourceText)
  ) {
    fail(
      `legacy or client-page row-model behavior entered the server table: ${normalize(path.relative(root, file))}`,
    );
  }
}

const retainedTanstackLegacyOwners = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      !/\.(?:test|spec)\.[^.]+$/.test(file) &&
      /from\s+["']@tanstack\/react-table\/legacy["']/.test(sourceText),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(retainedTanstackLegacyOwners) !==
  JSON.stringify([
    "src/Components/Common/TableContainer.tsx",
    "src/Components/Common/TableContainerReactTable.tsx",
  ])
) {
  fail(`retained TanStack legacy owners changed: ${JSON.stringify(retainedTanstackLegacyOwners)}`);
}

const safePresentationSources = [...sourceTexts.entries()].filter(
  ([file]) =>
    /modules[\\/]checkupino[\\/](?:audit|files)[\\/]/.test(file) &&
    !/\.(?:test|spec)\.[^.]+$/.test(file),
);
for (const [file, sourceText] of safePresentationSources) {
  if (
    /from\s+["'](?:axios|@reduxjs\/toolkit|@tanstack\/react-query)|\bfetch\s*\(|\.request\s*\(|dangerouslySetInnerHTML/.test(
      sourceText,
    )
  ) {
    fail(
      `network or raw-HTML behavior entered a presentation-only primitive: ${normalize(path.relative(root, file))}`,
    );
  }
}

const assertReadonlyInterfaceFields = (relativePath, interfaceName, expectedFields) => {
  const sourceText = sourceTexts.get(path.join(sourceRoot, ...relativePath.split("/")));
  const body = new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`).exec(
    sourceText ?? "",
  )?.[1];
  const fields = [...(body ?? "").matchAll(/readonly\s+(\w+)\s*:/g)]
    .map((match) => match[1])
    .sort();
  if (JSON.stringify(fields) !== JSON.stringify([...expectedFields].sort())) {
    fail(`${interfaceName} safe fields changed: ${JSON.stringify(fields)}`);
  }
};

assertReadonlyInterfaceFields("modules/checkupino/files/FilePresentation.tsx", "SafeFileMetadata", [
  "available",
  "createdAt",
  "label",
  "mimeType",
  "publicId",
  "sizeBytes",
]);
assertReadonlyInterfaceFields("modules/checkupino/audit/AuditTimeline.tsx", "SafeAuditEvent", [
  "actionLabel",
  "actorLabel",
  "occurredAt",
  "outcome",
  "publicId",
  "reason",
]);

const auditTimelineSource = sourceTexts.get(
  path.join(sourceRoot, "modules", "checkupino", "audit", "AuditTimeline.tsx"),
);
if (
  !auditTimelineSource ||
  /\b(?:before|after|disk|path|scan_status|retention_until|ip|userAgent|user_agent)\b/.test(
    auditTimelineSource,
  )
) {
  fail("private/raw audit fields entered the presentation-only timeline");
}

const formLibraryOwners = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      normalize(path.relative(sourceRoot, file)).startsWith("modules/checkupino/") &&
      !/\.(?:test|spec)\.[^.]+$/.test(file) &&
      /from\s+["'](?:@hookform\/resolvers\/zod|react-hook-form|zod)["']/.test(sourceText),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(formLibraryOwners) !==
  JSON.stringify(["src/modules/checkupino/forms/reactHookForm.ts"])
) {
  fail(`product form-library ownership changed: ${JSON.stringify(formLibraryOwners)}`);
}

const legacyFormOwners = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      normalize(path.relative(sourceRoot, file)).startsWith("modules/checkupino/") &&
      !/\.(?:test|spec)\.[^.]+$/.test(file) &&
      /from\s+["'](?:formik|yup)["']/.test(sourceText),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (legacyFormOwners.length > 0) {
  fail(`Formik/Yup entered the Checkupino module: ${JSON.stringify(legacyFormOwners)}`);
}

const overlayProductionSources = [...sourceTexts.entries()].filter(
  ([file]) =>
    normalize(path.relative(sourceRoot, file)).startsWith("modules/checkupino/overlays/") &&
    !/\.(?:test|spec)\.[^.]+$/.test(file),
);
for (const [file, sourceText] of overlayProductionSources) {
  if (/from\s+["']reactstrap["']/.test(sourceText)) {
    fail(
      `Reactstrap entered the product overlay boundary: ${normalize(path.relative(root, file))}`,
    );
  }
  if (/\b(?:localStorage|sessionStorage)\b/.test(sourceText)) {
    fail(
      `browser storage entered the product overlay boundary: ${normalize(path.relative(root, file))}`,
    );
  }
}

const reasonedArchiveSource = sourceTexts.get(
  path.join(sourceRoot, "modules", "checkupino", "overlays", "ReasonedArchiveDialog.tsx"),
);
const recentPasswordDialogSource = sourceTexts.get(
  path.join(sourceRoot, "modules", "checkupino", "overlays", "RecentPasswordDialog.tsx"),
);
if (
  !reasonedArchiveSource ||
  /recentPassword|current-password/.test(reasonedArchiveSource) ||
  !recentPasswordDialogSource ||
  /ArchiveReasonPayload|archiveReasonPayload/.test(recentPasswordDialogSource)
) {
  fail("archive reason and recent-password presentation boundaries were merged");
}

const productToastifyOwners = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      normalize(path.relative(sourceRoot, file)).startsWith("modules/checkupino/") &&
      !/\.(?:test|spec)\.[^.]+$/.test(file) &&
      /from\s+["']react-toastify["']|import\s+["']react-toastify\//.test(sourceText),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(productToastifyOwners) !==
  JSON.stringify(["src/modules/checkupino/feedback/Toast.tsx"])
) {
  fail(`product toast ownership changed: ${JSON.stringify(productToastifyOwners)}`);
}

const retainedRenderTimeToastFiles = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      !/\.(?:test|spec)\.[^.]+$/.test(file) && /^\s*\{toast(?:\.\w+)?\s*\(/m.test(sourceText),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (JSON.stringify(retainedRenderTimeToastFiles) !== JSON.stringify([])) {
  fail(`render-time toast allowlist changed: ${JSON.stringify(retainedRenderTimeToastFiles)}`);
}

const anyCount = [...sourceTexts.values()].reduce(
  (total, text) => total + (text.match(/\bany\b/g)?.length ?? 0),
  0,
);
if (anyCount > debt.ratchets.maximumAnyTokenCount) {
  fail(`any token ratchet increased: ${anyCount} > ${debt.ratchets.maximumAnyTokenCount}`);
}

const globalDeclarations = [
  ...(await readFile(path.join(root, "global.d.ts"), "utf8")).matchAll(
    /^declare module ['"]([^'"]+)['"];?$/gm,
  ),
].map((match) => match[1]);
const recordedAmbient = debt.ambientModules.map(({ module }) => module);
if (JSON.stringify(globalDeclarations) !== JSON.stringify(recordedAmbient)) {
  fail("global.d.ts ambient modules differ from the ordered type-debt ledger");
}
if (globalDeclarations.length !== debt.baselines.ambientModuleCount) {
  fail("ambient module count differs from its baseline");
}

const adapterSpecifier = "Components/Common/LegacyApexChart";
const adapterFile = path.join(sourceRoot, "Components", "Common", "LegacyApexChart.tsx");
const adapterConsumers = [...sourceTexts.values()].filter((text) =>
  text.includes(adapterSpecifier),
).length;
const directApexFiles = [...sourceTexts.values()].filter((text) =>
  /from\s+["']react-apexcharts["']/.test(text),
).length;
const adapterCastCount =
  sourceTexts.get(adapterFile)?.match(/as ReactApexChartProps\["options"\]/g)?.length ?? 0;

if (adapterConsumers > debt.ratchets.maximumLegacyApexImportCount) {
  fail("legacy Apex adapter consumer count increased");
}
if (directApexFiles !== 1 || adapterCastCount !== 1) {
  fail("legacy Apex compatibility boundary changed unexpectedly");
}

if (Object.hasOwn(tsconfig.compilerOptions, "baseUrl")) {
  fail("tsconfig baseUrl must not be restored");
}
if (
  Object.hasOwn(packageJson, "eslintConfig") ||
  Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  }).some((name) => name === "eslint" || name.startsWith("@typescript-eslint/"))
) {
  fail("ESLint or typescript-eslint re-entered the TypeScript 7 toolchain");
}

const pathMappings = Object.entries(tsconfig.compilerOptions.paths ?? {}).map(
  ([pattern, targets]) => ({
    prefix: pattern.replace(/\*$/, ""),
    targetPrefix: targets[0].replace(/\*$/, ""),
  }),
);
const aliasPrefixes = new Set(pathMappings.map(({ prefix }) => prefix));
const declaredPackages = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
]);
const nodeBuiltins = new Set([...builtinModules, ...builtinModules.map((name) => `node:${name}`)]);
const boundaryExceptions = new Set(
  (debt.boundaryExceptions ?? []).map(({ source, target }) => `${source}::${target}`),
);
const coreRoot = path.join(sourceRoot, "core");
const corePublicEntry = path.join(coreRoot, "index.ts");

const stripComments = (text) => {
  let result = "";
  let state = "code";

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (state === "line-comment") {
      if (character === "\n") {
        state = "code";
        result += character;
      } else {
        result += " ";
      }
      continue;
    }
    if (state === "block-comment") {
      if (character === "*" && next === "/") {
        result += "  ";
        index += 1;
        state = "code";
      } else {
        result += character === "\n" ? "\n" : " ";
      }
      continue;
    }
    if (state === "single" || state === "double" || state === "template") {
      result += character;
      if (character === "\\") {
        result += next ?? "";
        index += 1;
      } else if (
        (state === "single" && character === "'") ||
        (state === "double" && character === '"') ||
        (state === "template" && character === "`")
      ) {
        state = "code";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      result += "  ";
      index += 1;
      state = "line-comment";
    } else if (character === "/" && next === "*") {
      result += "  ";
      index += 1;
      state = "block-comment";
    } else {
      result += character;
      if (character === "'") state = "single";
      if (character === '"') state = "double";
      if (character === "`") state = "template";
    }
  }

  return result;
};

const parseImports = (_file, text) => {
  const source = stripComments(text);
  const imports = [];
  let statement = "";

  for (const line of source.split(/\r?\n/)) {
    if (!statement && /^\s*(?:import|export)\b(?!\s*\()/.test(line)) {
      statement = line;
    } else if (statement) {
      statement += `\n${line}`;
    }

    if (statement && (/;\s*$/.test(line) || /["']\s*$/.test(line))) {
      const fromMatch = statement.match(/\bfrom\s*["']([^"']+)["']/);
      const sideEffectMatch = statement.match(/^\s*import\s*["']([^"']+)["']/);
      const specifier = fromMatch?.[1] ?? sideEffectMatch?.[1];
      if (specifier) imports.push(specifier);
      statement = "";
    }
  }

  for (const pattern of [
    /\bimport\s*\(\s*["']([^"']+)["']/g,
    /\brequire\s*\(\s*["']([^"']+)["']/g,
  ]) {
    imports.push(...[...source.matchAll(pattern)].map((match) => match[1]));
  }

  return imports;
};

const parseStaticImports = (_file, text) => {
  const source = stripComments(text);
  const imports = [];
  let statement = "";

  for (const line of source.split(/\r?\n/)) {
    if (!statement && /^\s*(?:import|export)\b(?!\s*\()/.test(line)) {
      statement = line;
    } else if (statement) {
      statement += `\n${line}`;
    }

    if (statement && (/;\s*$/.test(line) || /["']\s*$/.test(line))) {
      const fromMatch = statement.match(/\bfrom\s*["']([^"']+)["']/);
      const sideEffectMatch = statement.match(/^\s*import\s*["']([^"']+)["']/);
      const specifier = fromMatch?.[1] ?? sideEffectMatch?.[1];
      if (specifier) imports.push(specifier);
      statement = "";
    }
  }

  imports.push(
    ...[...source.matchAll(/\brequire\s*\(\s*["']([^"']+)["']/g)].map((match) => match[1]),
  );

  return imports;
};

const rawEnvironmentReads = [...sourceTexts.entries()].flatMap(([file, sourceText]) =>
  [...stripComments(sourceText).matchAll(/\b(import\.meta\.env|process\.env)\b/g)].map((match) => ({
    expression: match[1],
    file: normalize(path.relative(root, file)),
  })),
);
if (
  rawEnvironmentReads.length !== 1 ||
  rawEnvironmentReads[0].file !== "src/core/runtime/config.ts" ||
  rawEnvironmentReads[0].expression !== "import.meta.env"
) {
  fail(`raw runtime environment reads changed: ${JSON.stringify(rawEnvironmentReads)}`);
}

const frontendEnvironmentExample = await readFile(path.join(root, ".env.example"), "utf8");
if (frontendEnvironmentExample.includes("VITE_DEFAULT_AUTH")) {
  fail("stale fake-auth environment configuration re-entered .env.example");
}

const packageName = (specifier) => {
  if (specifier.startsWith("@")) {
    return specifier.split("/").slice(0, 2).join("/");
  }
  return specifier.split("/")[0];
};

const isInternalSpecifier = (specifier) =>
  specifier.startsWith(".") || [...aliasPrefixes].some((prefix) => specifier.startsWith(prefix));

const importRecords = sourceFiles.flatMap((file) =>
  parseImports(file, sourceTexts.get(file)).map((specifier) => ({ file, specifier })),
);
const legacyHttpExceptionFiles = new Set((debt.legacyHttpExceptions ?? []).map(({ file }) => file));
const axiosImportFiles = new Set(
  importRecords
    .filter(({ specifier }) => specifier === "axios")
    .map(({ file }) => normalize(path.relative(root, file))),
);
const approvedAxiosImportFiles = new Set([
  "src/modules/checkupino/api/transport.ts",
  ...legacyHttpExceptionFiles,
]);
if (
  JSON.stringify([...axiosImportFiles].sort()) !==
  JSON.stringify([...approvedAxiosImportFiles].sort())
) {
  fail(`Axios import boundary changed: ${JSON.stringify([...axiosImportFiles].sort())}`);
}

const backendConfigReaders = [...sourceTexts.entries()]
  .filter(([, sourceText]) =>
    /runtimeConfig\.(?:apiBaseUrl|backendOrigin)\b/.test(stripComments(sourceText)),
  )
  .map(([file]) => normalize(path.relative(root, file)));
if (
  JSON.stringify(backendConfigReaders.sort()) !==
  JSON.stringify(["src/modules/checkupino/api/transport.ts"])
) {
  fail(
    `backend-origin config escaped the transport adapter: ${JSON.stringify(backendConfigReaders)}`,
  );
}

const globalAxiosStateFiles = [...sourceTexts.entries()]
  .filter(([, sourceText]) => /axios\.(?:defaults|interceptors)\b/.test(stripComments(sourceText)))
  .map(([file]) => normalize(path.relative(root, file)));
if (
  JSON.stringify(globalAxiosStateFiles.sort()) !==
  JSON.stringify([...legacyHttpExceptionFiles].sort())
) {
  fail(`global Axios state boundary changed: ${JSON.stringify(globalAxiosStateFiles)}`);
}

const authModuleRoot = path.join(sourceRoot, "modules", "checkupino", "auth");
const authModuleFiles = [...sourceTexts.entries()].filter(([file]) =>
  file.startsWith(`${authModuleRoot}${path.sep}`),
);
const authPersistenceFiles = authModuleFiles
  .filter(([, sourceText]) =>
    /\b(?:localStorage|sessionStorage|Authorization|Bearer)\b/.test(stripComments(sourceText)),
  )
  .map(([file]) => normalize(path.relative(root, file)));
if (authPersistenceFiles.length > 0) {
  fail(`browser/token persistence entered session auth: ${JSON.stringify(authPersistenceFiles)}`);
}

const legacyDirectionStateFiles = [...sourceTexts.entries()]
  .filter(([, sourceText]) =>
    /\b(?:changeLayoutDirection|layoutDirectionType|LAYOUT_DIRECTION_TYPES)\b|data-layout-direction/.test(
      stripComments(sourceText),
    ),
  )
  .map(([file]) => normalize(path.relative(root, file)));
if (legacyDirectionStateFiles.length > 0) {
  fail(`standalone direction state/control returned: ${JSON.stringify(legacyDirectionStateFiles)}`);
}

const directionWriters = [...sourceTexts.entries()]
  .filter(([, sourceText]) =>
    /(?:\.dir\s*=|setAttribute\(\s*["']dir["'])/.test(stripComments(sourceText)),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(directionWriters) !==
  JSON.stringify(["src/modules/checkupino/preferences/localization.ts"])
) {
  fail(`document direction authority changed: ${JSON.stringify(directionWriters)}`);
}

const legacyLocaleKeyOwners = [...sourceTexts.entries()]
  .filter(([, sourceText]) => stripComments(sourceText).includes("I18N_LANGUAGE"))
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(legacyLocaleKeyOwners) !==
  JSON.stringify(["src/modules/checkupino/preferences/localization.ts"])
) {
  fail(`legacy locale migration key escaped its owner: ${JSON.stringify(legacyLocaleKeyOwners)}`);
}

const i18nSource = sourceTexts.get(path.join(sourceRoot, "i18n.ts")) ?? "";
for (const unsupportedLocale of ["ar", "ch", "fr", "gr", "it", "ru", "sp"]) {
  if (new RegExp(`locales/${unsupportedLocale}\\.json`).test(i18nSource)) {
    fail(`unsupported product locale re-entered i18n: ${unsupportedLocale}`);
  }
}
if (/i18next-browser-languagedetector/.test(i18nSource)) {
  fail("browser language detection bypassed the versioned product locale preference");
}

const faTranslations = await readJson("src/locales/fa.json");
const enTranslations = await readJson("src/locales/en.json");
const productTranslationKeys = (catalog) =>
  Object.keys(catalog)
    .filter((key) => key.startsWith("product."))
    .sort();
const faProductKeys = productTranslationKeys(faTranslations);
const enProductKeys = productTranslationKeys(enTranslations);
if (JSON.stringify(faProductKeys) !== JSON.stringify(enProductKeys)) {
  fail("Persian and English product translation keys differ");
}
if (faProductKeys.length === 0) {
  fail("the product translation catalog is empty");
}

const multilingualShellFiles = [
  "src/Components/Common/FullScreenDropdown.tsx",
  "src/Components/Common/LanguageDropdown.tsx",
  "src/Components/Common/LightDark.tsx",
  "src/Components/Common/ProfileDropdown.tsx",
  "src/Components/Common/ReviewSlider.tsx",
  "src/Components/Common/RightSidebar.tsx",
  "src/Components/Common/SearchOption.tsx",
  "src/Layouts/Footer.tsx",
  "src/Layouts/Header.tsx",
  "src/Layouts/Sidebar.tsx",
  "src/pages/Authentication/ForgetPassword.tsx",
  "src/pages/Authentication/Login.tsx",
  "src/pages/Authentication/Register.tsx",
  "src/pages/Authentication/user-profile.tsx",
  "src/pages/AuthenticationInner/ParticlesAuth.tsx",
  "src/pages/DashboardEcommerce/BestSellingProducts.tsx",
  "src/pages/DashboardEcommerce/DashboardEcommerceCharts.tsx",
  "src/pages/DashboardEcommerce/index.tsx",
  "src/pages/DashboardEcommerce/RecentActivity.tsx",
  "src/pages/DashboardEcommerce/RecentOrders.tsx",
  "src/pages/DashboardEcommerce/Revenue.tsx",
  "src/pages/DashboardEcommerce/SalesByLocations.tsx",
  "src/pages/DashboardEcommerce/Section.tsx",
  "src/pages/DashboardEcommerce/StoreVisits.tsx",
  "src/pages/DashboardEcommerce/TopSellers.tsx",
  "src/pages/DashboardEcommerce/Widgets.tsx",
  "src/panel/menu.ts",
];
for (const relativeFile of multilingualShellFiles) {
  const sourceText = sourceTexts.get(path.join(root, relativeFile)) ?? "";
  if (/[\u0600-\u06ff]/u.test(sourceText)) {
    fail(`hard-coded Persian re-entered a multilingual shell surface: ${relativeFile}`);
  }
}

const forbiddenLocalizedSurfaceLiterals = new Map([
  ["src/Components/Common/SearchOption.tsx", [">Pages<", 'placeholder="Search..."']],
  [
    "src/Components/Common/RightSidebar.tsx",
    [">Theme Customizer<", ">Choose your layout<", ">Color Scheme<"],
  ],
  ["src/pages/Authentication/ForgetPassword.tsx", [">Forgot Password?<", ">Send Reset Link<"]],
  ["src/pages/Authentication/Register.tsx", [">Create New Account<", ">Sign Up<"]],
  ["src/pages/Authentication/user-profile.tsx", [">Change User Name<", ">User Name<"]],
  [
    "src/pages/DashboardEcommerce/BestSellingProducts.tsx",
    [">Best Selling Products<", ">Out of stock<"],
  ],
  ["src/pages/DashboardEcommerce/RecentActivity.tsx", [">Recent Activity<", ">Invite Now<"]],
  ["src/pages/DashboardEcommerce/RecentOrders.tsx", [">Recent Orders<", ">Order ID<"]],
  ["src/pages/DashboardEcommerce/SalesByLocations.tsx", [">Sales by Locations<"]],
  ["src/pages/DashboardEcommerce/StoreVisits.tsx", [">Store Visits by Source<"]],
  ["src/pages/DashboardEcommerce/TopSellers.tsx", [">Top Sellers<"]],
]);
for (const [relativeFile, forbiddenLiterals] of forbiddenLocalizedSurfaceLiterals) {
  const sourceText = sourceTexts.get(path.join(root, relativeFile)) ?? "";
  for (const literal of forbiddenLiterals) {
    if (sourceText.includes(literal)) {
      fail(
        `hard-coded English re-entered a localized Velzon surface: ${relativeFile} -> ${literal}`,
      );
    }
  }
}

const documentationRoot = path.resolve(root, "..", "docs");
const englishDocumentationFiles = [
  path.resolve(root, "..", "AI_BOOT.md"),
  path.resolve(root, "..", "CODEX_RULES.md"),
  path.resolve(root, "..", "CURRENT_TASK.md"),
  path.resolve(root, "..", "README.md"),
  path.join(root, "README.md"),
  ...(await walk(documentationRoot)).filter((file) => path.extname(file) === ".md"),
];
for (const file of englishDocumentationFiles) {
  const documentation = await readFile(file, "utf8");
  if (/[\u0600-\u06ff]/u.test(documentation)) {
    fail(`Persian prose entered English project documentation: ${normalize(file)}`);
  }
}

const themeSource = await readFile(path.join(sourceRoot, "assets", "scss", "themes.scss"), "utf8");
const rtlPluginSource = await readFile(
  path.join(sourceRoot, "assets", "scss", "rtl", "_plugins-rtl.scss"),
  "utf8",
);
for (const retainedRtlBundle of ["components-rtl", "layouts-rtl", "plugins-rtl", "pages-rtl"]) {
  if (themeSource.includes(retainedRtlBundle)) {
    fail(`unapproved retained Velzon RTL bundle entered the active theme: ${retainedRtlBundle}`);
  }
}
if (/\bhtml\s*\{\s*direction\s*:\s*rtl/.test(stripComments(rtlPluginSource))) {
  fail("an RTL stylesheet resumed forcing document direction");
}

const fontSource = await readFile(
  path.join(sourceRoot, "assets", "scss", "fonts", "_fonts.scss"),
  "utf8",
);
if (
  !fontSource.includes("Vazirmatn-v33.003-wght.woff2") ||
  !fontSource.includes("font-weight: 100 900") ||
  !fontSource.includes('--nebula-font-persian: "Vazirmatn", system-ui, sans-serif')
) {
  fail("approved local Vazirmatn variable-font contract changed");
}

const activeFontStyles = [
  path.join(sourceRoot, "assets", "scss", "fonts", "_fonts.scss"),
  path.join(sourceRoot, "assets", "scss", "plugins", "icons", "_materialdesignicons.scss"),
  path.join(sourceRoot, "assets", "scss", "plugins", "icons", "_boxicons.scss"),
  path.join(sourceRoot, "assets", "scss", "plugins", "icons", "_line-awesome.scss"),
  path.join(sourceRoot, "assets", "scss", "plugins", "icons", "_remixicon.scss"),
];
const activeFontUrls = [];
for (const file of activeFontStyles) {
  const stylesheet = stripComments(await readFile(file, "utf8"));
  for (const match of stylesheet.matchAll(/url\(\s*["']?([^)'\"]+)["']?\s*\)/g)) {
    const url = match[1];
    if (!url.includes("/fonts/")) {
      continue;
    }
    activeFontUrls.push(url);
    if (!/\.woff2(?:[?#].*)?$/i.test(url)) {
      fail(`legacy font format returned to the active build graph: ${url}`);
    }
  }
}
if (activeFontUrls.length !== 11) {
  fail(`active WOFF2 font contract changed: expected 11 sources, found ${activeFontUrls.length}`);
}
if (/font-family:\s*["']Roboto["']/.test(stripComments(fontSource))) {
  fail("the legacy local Roboto TTF declaration returned to the active font graph");
}

const indexHtmlSource = await readFile(path.join(root, "index.html"), "utf8");
for (const requiredStartupFragment of [
  '<html lang="fa" dir="rtl">',
  'localStorage.getItem("checkupino.locale.v1")',
  'localStorage.getItem("I18N_LANGUAGE")',
  'localStorage.getItem("nebula.layout.settings")',
  'matchMedia("(prefers-color-scheme: dark)")',
  'root.dir = locale === "fa" ? "rtl" : "ltr"',
  "root.dataset.bsTheme = colorMode",
]) {
  if (!indexHtmlSource.includes(requiredStartupFragment)) {
    fail(`pre-render locale/color bootstrap drifted: ${requiredStartupFragment}`);
  }
}

const syncExternalStoreFiles = [...sourceTexts.entries()]
  .filter(([, sourceText]) => /\buseSyncExternalStore\b/.test(stripComments(sourceText)))
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(syncExternalStoreFiles) !==
  JSON.stringify(["src/modules/checkupino/auth/useAdminAuth.ts"])
) {
  fail(`reactive auth store boundary changed: ${JSON.stringify(syncExternalStoreFiles)}`);
}

const shellAuthHookOwners = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      !/\.(?:test|spec)\.[^.]+$/.test(file) &&
      /(?:Layouts|Components[\\/]Common)[\\/]/.test(normalize(path.relative(sourceRoot, file))) &&
      /\buseProfile\s*\(/.test(stripComments(sourceText)),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (JSON.stringify(shellAuthHookOwners) !== JSON.stringify(["src/Layouts/ShellAuthContext.tsx"])) {
  fail(`shell auth subscriptions drifted: ${JSON.stringify(shellAuthHookOwners)}`);
}

const shellLifecycleSources = [
  "src/Components/Common/FullScreenDropdown.tsx",
  "src/Components/Common/RightSidebar.tsx",
  "src/Components/Common/SearchOption.tsx",
  "src/Layouts/Sidebar.tsx",
  "src/Layouts/VerticalLayouts/index.tsx",
  "src/Layouts/index.tsx",
].map((relativeFile) => sourceTexts.get(path.join(root, relativeFile)) ?? "");
if (
  shellLifecycleSources.some((sourceText) => /window\.onscroll\s*=/.test(stripComments(sourceText)))
) {
  fail("render-time window.onscroll ownership returned to the retained shell");
}
if (
  !shellLifecycleSources.every(
    (sourceText) =>
      !/addEventListener/.test(stripComments(sourceText)) ||
      /removeEventListener/.test(stripComments(sourceText)),
  )
) {
  fail("a retained shell listener has no colocated cleanup");
}

const systemColorSource =
  sourceTexts.get(
    path.join(sourceRoot, "modules", "checkupino", "preferences", "useResolvedColorMode.ts"),
  ) ?? "";
if (
  !systemColorSource.includes('preference !== "system"') ||
  !systemColorSource.includes('addEventListener("change"') ||
  !systemColorSource.includes('removeEventListener("change"')
) {
  fail("System color-mode listener lifecycle drifted");
}

const requiredAuthEdges = [
  ["src/Components/Hooks/UserHooks.ts", "modules/checkupino/auth/useAdminAuth"],
  ["src/slices/auth/login/thunk.ts", "modules/checkupino/auth/authority"],
];

const activeRouteSource = [
  sourceTexts.get(path.join(sourceRoot, "Routes", "allRoutes.tsx")) ?? "",
  sourceTexts.get(path.join(sourceRoot, "panel", "routes.tsx")) ?? "",
  sourceTexts.get(path.join(sourceRoot, "panel", "registry.ts")) ?? "",
  sourceTexts.get(path.join(sourceRoot, "modules", "checkupino", "manifest.ts")) ?? "",
].join("\n");
for (const removedRoute of [
  "/dashboard",
  "/forgot-password",
  "/index",
  "/logout",
  "/profile",
  "/register",
]) {
  if (
    activeRouteSource.includes(`"${removedRoute}"`) ||
    activeRouteSource.includes(`'${removedRoute}'`)
  ) {
    fail(`removed product route was registered again: ${removedRoute}`);
  }
}
const panelRoutesSource = sourceTexts.get(path.join(sourceRoot, "panel", "routes.tsx")) ?? "";
if (!panelRoutesSource.includes("adminProductRegistry.routes")) {
  fail("the active product routes no longer derive from the approved relative registry");
}
const devtoolEntrySource =
  sourceTexts.get(path.join(sourceRoot, "Routes", "devtoolEntryContract.ts")) ?? "";
if (
  devtoolEntrySource.includes('DEV_TOOLBOX_BASE_PATH = "/panel') ||
  !devtoolEntrySource.includes('DEV_TOOLBOX_BASE_PATH = "/dev"')
) {
  fail("the devtool route contract escaped or duplicated the /panel router basename");
}
const viteConfigSource = await readFile(path.join(root, "vite.config.ts"), "utf8");
if (!/\bbase:\s*["']\/panel\/["']/.test(viteConfigSource)) {
  fail("Vite and BrowserRouter no longer share the canonical /panel basename");
}
if (
  !viteConfigSource.includes('name: "checkupino:canonical-panel-base"') ||
  !viteConfigSource.includes('requestUrl === "/panel"') ||
  !viteConfigSource.includes('response.setHeader("Location", `/panel/${query}`)') ||
  !viteConfigSource.includes("configureServer(server)") ||
  !viteConfigSource.includes("configurePreviewServer(server)")
) {
  fail("the bare /panel development/preview canonical redirect was removed or weakened");
}

const thirdPartyNoticesSource = await readFile(
  path.join(root, "public", "THIRD_PARTY_NOTICES.txt"),
  "utf8",
);
for (const marker of [
  "CKEditor 5 version 48.5.0",
  "integration version 11.2.0",
  "GPL-2.0-or-later",
  "https://github.com/ckeditor/ckeditor5",
]) {
  if (!thirdPartyNoticesSource.includes(marker)) {
    fail(`the distributable CKEditor GPL notice changed: ${marker}`);
  }
}

const packageManifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (
  packageManifest.dependencies?.["react-quilljs"] !== "2.0.4" ||
  packageManifest.dependencies?.quill !== "2.0.2"
) {
  fail("the audited Quill 2 editor compatibility pair is no longer pinned exactly");
}

const activeLayoutSource = sourceTexts.get(path.join(sourceRoot, "Layouts", "index.tsx")) ?? "";
if (
  !/RightSidebar/.test(activeLayoutSource) ||
  /ProductPreferencesDrawer/.test(activeLayoutSource)
) {
  fail("the approved Velzon customizer composition changed");
}

const headerSurfaceSource = sourceTexts.get(path.join(sourceRoot, "Layouts", "Header.tsx")) ?? "";
const sidebarSurfaceSource = sourceTexts.get(path.join(sourceRoot, "Layouts", "Sidebar.tsx")) ?? "";
for (const marker of [
  "horizontal-logo",
  "topnav-hamburger-icon",
  "SearchOption",
  "LanguageDropdown",
  "FullScreenDropdown",
  "LightDark",
  "ProfileDropdown",
  "shellAssets.logoSm",
  "shellAssets.logoDark",
  "shellAssets.logoLight",
]) {
  if (!headerSurfaceSource.includes(marker)) {
    fail(`the approved Velzon header composition changed: ${marker}`);
  }
}
for (const marker of [
  "navbar-brand-box",
  "logo-sm",
  "logo-lg",
  "shellAssets.logoSm",
  "shellAssets.logoDark",
  "shellAssets.logoLight",
]) {
  if (!sidebarSurfaceSource.includes(marker)) {
    fail(`the approved Velzon sidebar composition changed: ${marker}`);
  }
}

const loginSurfaceSource =
  sourceTexts.get(path.join(sourceRoot, "pages", "Authentication", "Login.tsx")) ?? "";
for (const forbiddenLoginFragment of ["Password123!", "admin@checkupino.test"]) {
  if (loginSurfaceSource.includes(forbiddenLoginFragment)) {
    fail(`connected Velzon login regressed: ${forbiddenLoginFragment}`);
  }
}
for (const requiredLoginMarker of [
  "ParticlesAuth",
  "logoLight",
  "auth-page-content",
  "auth-logo",
  "justify-content-center",
  'Card className="mt-4"',
  'CardBody className="p-4"',
  "CardBody",
  "adminAuthAuthority.login",
]) {
  if (!loginSurfaceSource.includes(requiredLoginMarker)) {
    fail(`the connected Velzon login composition changed: ${requiredLoginMarker}`);
  }
}

const profileSurfaceSource =
  sourceTexts.get(path.join(sourceRoot, "Components", "Common", "ProfileDropdown.tsx")) ?? "";
if (
  !/adminAuthAuthority\.logout\(\)/.test(profileSurfaceSource) ||
  /(?:to|href)\s*=\s*["']\/logout["']/.test(profileSurfaceSource) ||
  !profileSurfaceSource.includes("shellAssets.profileAvatar")
) {
  fail("controlled logout or approved Velzon profile presentation drifted");
}

const registrySource = sourceTexts.get(path.join(sourceRoot, "panel", "registry.ts")) ?? "";
if (!registrySource.includes("../pages/DashboardEcommerce")) {
  fail("the product registry no longer loads the approved Velzon dashboard presentation");
}
const activeMenuSource =
  sourceTexts.get(path.join(sourceRoot, "Layouts", "LayoutMenuData.tsx")) ?? "";
if (
  !activeMenuSource.includes("adminCapabilitiesFor(userProfile).accessDeveloperTools") ||
  !activeMenuSource.includes('import("../devtools/ToolboxNavigationData")') ||
  activeMenuSource.includes('from "../devtools/toolboxMenu"')
) {
  fail("active toolbox navigation no longer derives visibility from the root-admin capability");
}
for (const [relativeFile, requiredSpecifier] of requiredAuthEdges) {
  const sourceText = sourceTexts.get(path.join(root, relativeFile));
  if (!sourceText?.includes(requiredSpecifier)) {
    fail(`${relativeFile} bypassed the shared auth authority`);
  }
}

const authEndpointFiles = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      !/\.(?:test|spec)\.[^.]+$/.test(file) &&
      /["'`]\/sanctum\/csrf-cookie|["'`]\/api\/auth\/(?:confirm-password|login|me|logout)/.test(
        stripComments(sourceText),
      ),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(authEndpointFiles) !==
  JSON.stringify([
    "src/modules/checkupino/auth/gateway.ts",
    "src/modules/checkupino/auth/recentPassword.ts",
  ])
) {
  fail(`session endpoint ownership changed: ${JSON.stringify(authEndpointFiles)}`);
}

const protectedRouteSource =
  sourceTexts.get(path.join(sourceRoot, "Routes", "AuthProtected.tsx")) ?? "";
if (!stripComments(protectedRouteSource).includes("adminCapabilitiesFor(userProfile)")) {
  fail("protected routing bypassed the role-derived capability seam");
}

const recentPasswordSource =
  sourceTexts.get(path.join(sourceRoot, "modules", "checkupino", "auth", "recentPassword.ts")) ??
  "";
if (/\b900\b|password_confirmed_at/.test(stripComments(recentPasswordSource))) {
  fail("server-owned recent-password expiry state entered the frontend coordinator");
}

const productionCreateApiFiles = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      !/\.(?:test|spec)\.[^.]+$/.test(file) && /\bcreateApi\s*\(/.test(stripComments(sourceText)),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(productionCreateApiFiles) !==
  JSON.stringify(["src/modules/checkupino/query/api.ts"])
) {
  fail(`RTK Query API ownership changed: ${JSON.stringify(productionCreateApiFiles)}`);
}

const forbiddenServerStatePackages = [
  "@apollo/client",
  "@tanstack/react-query",
  "react-query",
  "swr",
];
const installedServerStateAlternatives = forbiddenServerStatePackages.filter((name) =>
  declaredPackages.has(name),
);
if (installedServerStateAlternatives.length > 0) {
  fail(
    `a second server-state system entered the package graph: ${JSON.stringify(installedServerStateAlternatives)}`,
  );
}

const storeSource = sourceTexts.get(path.join(sourceRoot, "store.ts")) ?? "";
const reducersSource = sourceTexts.get(path.join(sourceRoot, "slices", "index.ts")) ?? "";
if (
  !stripComments(storeSource).includes("checkupinoApi.middleware") ||
  !stripComments(reducersSource).includes("[checkupinoApi.reducerPath]: checkupinoApi.reducer")
) {
  fail("the Checkupino query API is not wired through both Redux reducer and middleware seams");
}

const productionRegistryComposerFiles = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      !/\.(?:test|spec)\.[^.]+$/.test(file) &&
      /\bcreateProductManifest\s*\(/.test(stripComments(sourceText)),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (JSON.stringify(productionRegistryComposerFiles) !== JSON.stringify(["src/panel/registry.ts"])) {
  fail(`product registry ownership changed: ${JSON.stringify(productionRegistryComposerFiles)}`);
}

const legacyRouteDefinitionFiles = [...sourceTexts.entries()]
  .filter(
    ([file, sourceText]) =>
      !/\.(?:test|spec)\.[^.]+$/.test(file) && /\bpageRoute\s*\(/.test(stripComments(sourceText)),
  )
  .map(([file]) => normalize(path.relative(root, file)))
  .sort();
if (
  JSON.stringify(legacyRouteDefinitionFiles) !==
  JSON.stringify(["src/Routes/allRoutes.tsx", "src/devtools/toolboxRoutes.tsx"])
) {
  fail(
    `a manual route definition escaped the F24/F25 exceptions: ${JSON.stringify(legacyRouteDefinitionFiles)}`,
  );
}
const undeclaredCounts = new Map();

for (const { specifier } of importRecords) {
  if (isInternalSpecifier(specifier) || nodeBuiltins.has(specifier)) {
    continue;
  }
  const dependency = packageName(specifier);
  if (!declaredPackages.has(dependency)) {
    undeclaredCounts.set(dependency, (undeclaredCounts.get(dependency) ?? 0) + 1);
  }
}

const recordedUndeclared = new Map(
  (debt.undeclaredImports ?? []).map(({ package: name, importCount }) => [name, importCount]),
);
if (
  JSON.stringify([...undeclaredCounts].sort()) !== JSON.stringify([...recordedUndeclared].sort())
) {
  fail(
    `undeclared dependency inventory changed: ${JSON.stringify(Object.fromEntries([...undeclaredCounts].sort()))}`,
  );
}

const exists = async (target) => {
  try {
    return (await stat(target)).isFile();
  } catch {
    return false;
  }
};

const resolveInternal = async (file, rawSpecifier) => {
  const specifier = rawSpecifier.split("?")[0];
  let base;

  if (specifier.startsWith(".")) {
    base = path.resolve(path.dirname(file), specifier);
  } else {
    const mapping = pathMappings.find(({ prefix }) => specifier.startsWith(prefix));
    if (!mapping) return null;
    base = path.resolve(root, mapping.targetPrefix, specifier.slice(mapping.prefix.length));
  }

  const candidates = [
    base,
    ...resolvableExtensions.map((extension) => `${base}${extension}`),
    ...resolvableExtensions.map((extension) => path.join(base, `index${extension}`)),
  ];

  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  return null;
};

const assertExactCase = async (target, sourceFile, specifier) => {
  const relative = path.relative(root, target);
  let current = root;

  for (const segment of relative.split(path.sep)) {
    const entries = await readdir(current);
    if (!entries.includes(segment)) {
      fail(
        `case-wrong internal import ${specifier} in ${normalize(path.relative(root, sourceFile))}`,
      );
    }
    current = path.join(current, segment);
  }
};

const layerOf = (file) => {
  const relative = normalize(path.relative(sourceRoot, file));
  if (relative.startsWith("core/")) return "core";
  if (relative.startsWith("modules/checkupino/")) return "module";
  if (relative.startsWith("devtools/")) return "devtools";
  return "legacy";
};

const forbiddenCoreMarkers =
  /\b(?:checkupino|sanctum|themesbrand|velzon)\b|\/api\/auth|root-admin/i;
for (const [file, sourceText] of sourceTexts) {
  if (
    layerOf(file) === "core" &&
    !/\.(?:test|spec)\.[^.]+$/.test(file) &&
    forbiddenCoreMarkers.test(stripComments(sourceText))
  ) {
    fail(
      `product/backend-specific marker entered reusable core: ${normalize(path.relative(root, file))}`,
    );
  }
}

for (const record of importRecords.filter(({ specifier }) => isInternalSpecifier(specifier))) {
  const resolved = await resolveInternal(record.file, record.specifier);
  if (!resolved) {
    fail(
      `unresolved internal import ${record.specifier} in ${normalize(path.relative(root, record.file))}`,
    );
  }
  await assertExactCase(resolved, record.file, record.specifier);

  if (
    resolved === path.join(sourceRoot, "assets", "scss", "plugins", "_echarts.scss") &&
    normalize(path.relative(root, record.file)) !== echartsAdapterPath
  ) {
    fail("retained ECharts stylesheet must load only through its lazy chart adapter");
  }

  const sourceLayer = layerOf(record.file);
  const targetLayer = layerOf(resolved);
  if (sourceLayer === "core" && targetLayer !== "core") {
    fail(
      `core reverse-import boundary violated: ${normalize(path.relative(root, record.file))} -> ${record.specifier}`,
    );
  }
  if (sourceLayer === "module" && !["core", "module"].includes(targetLayer)) {
    fail("Checkupino module boundary violated");
  }
  if (sourceLayer === "module" && targetLayer === "core") {
    const rawSpecifier = record.specifier.split("?")[0];
    const importTarget = path.resolve(path.dirname(record.file), rawSpecifier);
    if (importTarget !== coreRoot && importTarget !== corePublicEntry) {
      fail(
        `Checkupino module bypassed the core public API: ${normalize(path.relative(root, record.file))} -> ${record.specifier}`,
      );
    }
  }
  if (sourceLayer !== "devtools" && targetLayer === "devtools") {
    const edge = `${normalize(path.relative(root, record.file))}::${record.specifier}`;
    if (!boundaryExceptions.has(edge)) {
      fail(
        `devtools entered ${sourceLayer} graph: ${normalize(path.relative(root, record.file))} -> ${record.specifier}`,
      );
    }
  }
}

const collectStaticReachableFiles = async (entryFiles) => {
  const pending = [...entryFiles];
  const reachable = new Set();

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || reachable.has(file)) continue;
    reachable.add(file);

    for (const specifier of parseStaticImports(file, sourceTexts.get(file) ?? "")) {
      if (!isInternalSpecifier(specifier)) continue;
      const resolved = await resolveInternal(file, specifier);
      if (resolved && sourceTexts.has(resolved) && !reachable.has(resolved)) {
        pending.push(resolved);
      }
    }
  }

  return reachable;
};

const normalGraphEntries = [
  path.join(sourceRoot, "index.tsx"),
  path.join(sourceRoot, "pages", "Authentication", "ForgetPassword.tsx"),
  path.join(sourceRoot, "pages", "Authentication", "Login.tsx"),
  path.join(sourceRoot, "pages", "Authentication", "Register.tsx"),
  path.join(sourceRoot, "pages", "Authentication", "user-profile.tsx"),
  path.join(sourceRoot, "pages", "DashboardEcommerce", "index.tsx"),
];
const normalReachableFiles = await collectStaticReachableFiles(normalGraphEntries);
if (normalReachableFiles.has(path.join(root, echartsAdapterPath))) {
  fail("the ECharts adapter and its stylesheet entered the normal startup graph");
}

const echartsStyleFile = path.join(sourceRoot, "assets", "scss", "plugins", "_echarts.scss");
const echartsStyle = stripComments(await readFile(echartsStyleFile, "utf8"));
if (
  echartsStyle.replace(/\s+/g, "") !== ".e-charts{height:350px;}.e-charts-height{height:300px;}"
) {
  fail("the retained ECharts stylesheet no longer preserves its original height rules");
}
for (const file of (await walk(path.join(sourceRoot, "assets", "scss"))).filter((file) =>
  /\.(?:scss|css)$/.test(file),
)) {
  const stylesheet = stripComments(await readFile(file, "utf8"));
  if (
    /@(?:import|use|forward)\s+[^;]*["'](?:[^"']*\/)?_?echarts(?:\.scss|\.css)?["']/.test(
      stylesheet,
    )
  ) {
    fail(
      `ECharts stylesheet re-entered the shared style graph: ${normalize(path.relative(root, file))}`,
    );
  }
}

const toolboxStyleEntryPath = path.join(sourceRoot, "devtools", "toolbox.scss");
const toolboxStyleEntry = stripComments(await readFile(toolboxStyleEntryPath, "utf8"));
const interactiveAppStyles = stripComments(
  await readFile(
    path.join(sourceRoot, "assets", "scss", "config", "Interactive", "app.scss"),
    "utf8",
  ),
);
const sharedThemeStyles = stripComments(
  await readFile(path.join(sourceRoot, "assets", "scss", "themes.scss"), "utf8"),
);
const toolboxStyleFamilies = [
  "plugins/prismjs",
  "plugins/sweetalert2",
  "plugins/dropzone",
  "plugins/range-slider",
  "plugins/sortablejs",
  "plugins/tour",
  "plugins/multijs",
  "plugins/colorpicker",
  "plugins/filepond",
  "plugins/form-input-spin",
  "plugins/ckeditor",
  "plugins/quilljs",
  "plugins/gridjs",
  "plugins/listjs",
  "plugins/chartjs",
  "plugins/google-map",
  "plugins/autocomplete",
  "plugins/leaflet-maps",
  "plugins/fullcalendar",
  "plugins/emoji-picker",
  "plugins/datatables",
  "plugins/select2",
  "plugins/flag-input",
  "pages/blog",
  "pages/timeline",
  "pages/gallery",
  "pages/errors",
  "pages/profile",
  "pages/sitemap",
  "pages/team",
  "pages/coming-soon",
  "pages/search-results",
  "pages/invoice",
  "pages/chat",
  "pages/email",
  "pages/kanban",
  "pages/landing",
  "pages/nft-landing",
  "pages/file-manager",
  "pages/to-do",
  "pages/jobs",
  "pages/job-landing",
];
let previousToolboxStyleIndex = -1;
for (const family of toolboxStyleFamilies) {
  const toolboxMarker = `@import "../assets/scss/${family}";`;
  const toolboxStyleIndex = toolboxStyleEntry.indexOf(toolboxMarker);
  if (toolboxStyleIndex <= previousToolboxStyleIndex) {
    fail(`toolbox stylesheet family is absent, duplicated, or out of order: ${family}`);
  }
  previousToolboxStyleIndex = toolboxStyleIndex;

  const sharedMarker = `@import "../../${family}";`;
  if (interactiveAppStyles.includes(sharedMarker)) {
    fail(`toolbox-only stylesheet returned to the normal app graph: ${family}`);
  }
}

for (const vendorBase of ["shepherd.css", "mermaid.min.css"]) {
  const toolboxMarker = `@import "../assets/scss/${vendorBase}";`;
  if (!toolboxStyleEntry.includes(toolboxMarker)) {
    fail(`toolbox vendor stylesheet is no longer lazy-owned: ${vendorBase}`);
  }
  if (sharedThemeStyles.includes(vendorBase)) {
    fail(`toolbox vendor stylesheet returned to the normal theme: ${vendorBase}`);
  }
}

for (const toolboxOverride of [
  ".noUi-horizontal .noUi-handle",
  ".dropzone .dz-message",
  ".fc-direction-ltr .fc-daygrid-event.fc-event-end",
  ".ql-container.ql-snow",
  ".rangeslider-horizontal .rangeslider__fill",
  ".chat-conversation .chat-list .message-box-drop",
  "#tsparticles canvas",
  "aside.EmojiPickerReact.epr-main",
  ".react-dual-listbox",
  ".css-b62m3t-container",
]) {
  if (!toolboxStyleEntry.includes(toolboxOverride)) {
    fail(`retained toolbox override escaped its lazy stylesheet: ${toolboxOverride}`);
  }
  if (sharedThemeStyles.includes(toolboxOverride)) {
    fail(`retained toolbox override returned to the normal theme: ${toolboxOverride}`);
  }
}

const toolboxRouterSource =
  sourceTexts.get(path.join(sourceRoot, "devtools", "ToolboxRouter.tsx")) ?? "";
if (!toolboxRouterSource.includes('import "./toolbox.scss"')) {
  fail("the root-only ToolboxRouter no longer owns the retained toolbox stylesheet entry");
}
const retainedChatThunkSource = stripComments(
  await readFile(path.join(sourceRoot, "slices", "chat", "thunk.ts"), "utf8"),
);
if (
  retainedChatThunkSource.includes("fakebackend_helper") ||
  /(?:api-node\.themesbrand\.website|\bapi\.(?:get|create|put|delete)\b)/.test(
    retainedChatThunkSource,
  )
) {
  fail("the retained static chat demo resumed external/backend requests");
}
if (!retainedChatThunkSource.includes('from "../../common/data/chat"')) {
  fail("the retained static chat demo no longer owns direct local fixtures");
}
const retainedChatPageSource =
  sourceTexts.get(path.join(sourceRoot, "pages", "Chat", "index.tsx")) ?? "";
if (
  !retainedChatPageSource.includes('from "../../slices/chat/thunk"') ||
  retainedChatPageSource.includes('from "../../slices/thunks"')
) {
  fail("the retained chat page resumed loading the external demo-thunk barrel");
}
const normalMomentOwners = momentOwners.filter((file) =>
  normalReachableFiles.has(path.join(root, ...file.split("/"))),
);
if (normalMomentOwners.length > 0) {
  fail(`retained Moment entered the normal product graph: ${JSON.stringify(normalMomentOwners)}`);
}
const forbiddenNormalGraphFiles = new Set([
  "src/common/data/index.ts",
  "src/config.ts",
  "src/devtools/installReducers.ts",
  "src/helpers/api_helper.ts",
  "src/helpers/fakebackend_helper.ts",
  "src/slices/thunks.ts",
]);
const forbiddenNormalGraphPrefixes = [
  "src/slices/apiKey/",
  "src/slices/calendar/",
  "src/slices/chat/",
  "src/slices/crm/",
  "src/slices/crypto/",
  "src/slices/dashboardAnalytics/",
  "src/slices/dashboardCRM/",
  "src/slices/dashboardCrypto/",
  "src/slices/dashboardEcommerce/",
  "src/slices/dashboardNFT/",
  "src/slices/dashboardProject/",
  "src/slices/ecommerce/",
  "src/slices/fileManager/",
  "src/slices/invoice/",
  "src/slices/jobs/",
  "src/slices/mailbox/",
  "src/slices/projects/",
  "src/slices/tasks/",
  "src/slices/team/",
  "src/slices/tickets/",
  "src/slices/todos/",
];
const forbiddenNormalReachability = [...normalReachableFiles]
  .map((file) => normalize(path.relative(root, file)))
  .filter(
    (file) =>
      forbiddenNormalGraphFiles.has(file) ||
      forbiddenNormalGraphPrefixes.some((prefix) => file.startsWith(prefix)),
  )
  .sort();
if (forbiddenNormalReachability.length > 0) {
  fail(
    `demo state/data/client entered the normal graph: ${JSON.stringify(forbiddenNormalReachability)}`,
  );
}

const toolboxRouteSource = sourceTexts.get(path.join(sourceRoot, "devtools", "toolboxRoutes.tsx"));
if (
  !toolboxRouteSource?.includes('await import("./installReducers")') ||
  !toolboxRouteSource.includes("installDevtoolReducers()")
) {
  fail("toolbox routes no longer opt into retained demo reducers at their lazy boundary");
}

const layoutMenuSource = sourceTexts.get(path.join(sourceRoot, "Layouts", "LayoutMenuData.tsx"));
if (
  !layoutMenuSource?.includes('import("../devtools/ToolboxNavigationData")') ||
  layoutMenuSource.includes('from "../devtools/toolboxMenu"')
) {
  fail("the normal shell no longer lazy-loads root-only toolbox menu definitions");
}

const composedRoutesSource = sourceTexts.get(path.join(sourceRoot, "Routes", "allRoutes.tsx"));
if (
  !composedRoutesSource?.includes('import("../devtools/ToolboxRouter")') ||
  composedRoutesSource.includes('from "../devtools/toolboxRoutes"')
) {
  fail("the normal route composer no longer lazy-loads the root-only toolbox router");
}

for (const exclusion of [
  ...(debt.lintExclusions ?? []),
  ...(debt.boundaryExceptions ?? []).map(({ source }) => ({ file: source })),
  ...(debt.legacyHttpExceptions ?? []),
]) {
  if (exclusion.file === "src/Layouts/LayoutMenuData.tsx") {
    const menuSource = sourceTexts.get(path.join(root, exclusion.file)) ?? "";
    if (
      menuSource.includes('from "./ShellAuthContext"') &&
      !menuSource.includes("Components/Hooks/UserHooks")
    ) {
      continue;
    }
  }

  if (exclusion.file === "src/Routes/allRoutes.tsx") {
    const routesSource = sourceTexts.get(path.join(root, exclusion.file)) ?? "";
    if (
      routesSource.includes('import("../devtools/ToolboxRouter")') &&
      !routesSource.includes('from "../devtools/toolboxRoutes"')
    ) {
      continue;
    }
  }

  const result = spawnSync("git", ["diff", "--quiet", "--", exclusion.file], {
    cwd: root,
    stdio: "ignore",
  });
  if (result.status !== 0) {
    fail(`${exclusion.file} changed while excluded from lint`);
  }
}

if (process.argv.includes("--self-test")) {
  const fakePackage = packageName("@scope/example/subpath");
  if (fakePackage !== "@scope/example") fail("dependency fixture failed");
  if (declaredPackages.has("quality-fixture-undeclared-package")) {
    fail("undeclared dependency negative fixture failed");
  }
  const coreLayer = layerOf(path.join(sourceRoot, "core", "x.ts"));
  const moduleLayer = layerOf(path.join(sourceRoot, "modules", "checkupino", "x.ts"));
  if (coreLayer !== "core" || moduleLayer !== "module") {
    fail("boundary fixture failed");
  }
  if (!(coreLayer === "core" && moduleLayer !== "core")) {
    fail("reverse-boundary negative fixture failed");
  }
  let rejectedWrongCase = false;
  try {
    await assertExactCase(
      path.join(sourceRoot, "components", "Common", "LegacyApexChart.tsx"),
      adapterFile,
      "fixture/wrong-case",
    );
  } catch {
    rejectedWrongCase = true;
  }
  if (!rejectedWrongCase) fail("case-sensitivity negative fixture failed");
}

console.log(
  `Quality ratchets pass: any=${anyCount}, ambient=${globalDeclarations.length}, legacyApex=${adapterConsumers}, undeclared=${undeclaredCounts.size}.`,
);
