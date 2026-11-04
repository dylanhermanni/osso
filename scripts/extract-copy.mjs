import ts from "typescript";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const sources = [];
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (
      /\.tsx?$/.test(path) &&
      !/content-(provider|admin)|\/site-copy\//.test(path)
    )
      sources.push(path);
  }
}
walk(join(root, "src/components"));
for (const path of [
  "src/app/layout.tsx",
  "src/app/error.tsx",
  "src/app/loading.tsx",
  "src/app/not-found.tsx",
  "src/app/actions.ts",
  "src/app/password-actions.ts",
  "src/lib/validation.ts",
])
  sources.push(join(root, path));
const normalize = (value) => value.replace(/\s+/g, " ").trim();
const hash = (value) => {
  let h = 2166136261;
  for (const c of value) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return "copy_" + (h >>> 0).toString(16).padStart(8, "0");
};
const catalog = new Map();
function add(value, path, template = false) {
  value = normalize(value);
  if (!/[\p{L}]/u.test(value) || value.length > 6000) return;
  const key = hash(value);
  if (catalog.has(key) && catalog.get(key).source !== value)
    throw new Error("Copy key collision: " + value);
  const group = path.includes("editor")
    ? "Formulieren en velden"
    : path.includes("calendar")
      ? "Planning"
      : path.includes("finance")
        ? "Financiën"
        : path.includes("actions") || path.includes("validation")
          ? "Meldingen en validatie"
          : path.includes("layout")
            ? "App en browser"
            : path.includes("ui/")
              ? "Knoppen en vensters"
              : "Website en navigatie";
  const entry = catalog.get(key) || {
    key,
    source: value,
    groups: [],
    template,
  };
  if (!entry.groups.includes(group)) entry.groups.push(group);
  entry.template ||= template;
  catalog.set(key, entry);
}
for (const path of sources) {
  const sf = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const file = relative(root, path);
  const visit = (node) => {
    let attr = node;
    while (attr.parent && !ts.isJsxAttribute(attr) && !ts.isStatement(attr))
      attr = attr.parent;
    const displayAttributes = new Set([
      "title",
      "description",
      "placeholder",
      "aria-label",
      "aria-description",
      "alt",
      "label",
    ]);
    const inBlockedAttribute =
      ts.isJsxAttribute(attr) && !displayAttributes.has(attr.name.getText(sf));
    if (ts.isJsxText(node)) add(node.text, file);
    else if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node)
    ) {
      const value = node.text;
      const parent = node.parent;
      const isImport =
        ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
      const isPropertyName =
        (ts.isPropertyAssignment(parent) || ts.isPropertySignature(parent)) &&
        parent.name === node;
      const isJsx =
        ts.isJsxAttribute(parent) &&
        displayAttributes.has(parent.name.getText(sf));
      const natural =
        /[A-ZÀ-ÖØ-Þ]/.test(value) || /[a-z].* [a-z].*[.!?]/i.test(value);
      const technical =
        /^(https?:|\/|@|#|\.\.?\/)/.test(value) ||
        /\b(select |insert |update |create table|\.tsx?\b|process\.env)/i.test(
          value,
        ) ||
        /^(?:[A-Z_]{2,}|[a-z]+[A-Z][A-Za-z]+|[a-z]{2}-[A-Z]{2}|Europe\/Amsterdam|Database operation:)$/.test(
          value,
        );
      if (
        !isImport &&
        !isPropertyName &&
        !inBlockedAttribute &&
        !technical &&
        (isJsx || natural)
      )
        add(value, file);
    } else if (ts.isTemplateExpression(node) && !inBlockedAttribute) {
      let value = node.head.text;
      node.templateSpans.forEach((span, i) => {
        value += `{${i + 1}}` + span.literal.text;
      });
      if (
        /[A-Za-zÀ-ÖØ-Þ]/.test(value) &&
        !/className|https?:|\/\?|\.csv|^[a-z0-9_]+[=:]|^(paid|share)_/.test(
          value,
        )
      )
        add(value, file, true);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}
// Labels emitted by calendar/browser integrations and the offline page.
for (const text of [
  "Uitgaven",
  "vandaag",
  "Vandaag",
  "Maand",
  "Week",
  "Dag",
  "Lijst",
  "Vorige",
  "Volgende",
  "Geen afspraken om weer te geven",
  "hele dag",
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
  "ma",
  "di",
  "wo",
  "do",
  "vr",
  "za",
  "zo",
])
  add(text, "calendar");
for (const text of [
  "Even offline.",
  "Maak verbinding met internet om je huisgegevens veilig te bekijken en te wijzigen.",
  "Opnieuw proberen",
  "Cheese the Rooster · offline",
  "Alles voor ons thuis, op één plek.",
  "Cheese",
])
  add(text, "layout");
writeFileSync(
  join(root, "src/lib/site-copy/catalog.json"),
  JSON.stringify(
    [...catalog.values()].sort((a, b) =>
      a.source.localeCompare(b.source, "nl"),
    ),
    null,
    2,
  ) + "\n",
);
console.log(`Copy catalog: ${catalog.size} texts`);
