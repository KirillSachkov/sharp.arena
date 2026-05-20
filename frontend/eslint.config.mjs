import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

// Feature-Sliced Design layers, top → bottom. Each layer may import from
// itself or any layer below. See ../.claude/rules/frontend-fsd.md.
const fsdLayers = [
  { type: "app", pattern: "src/app/**" },
  { type: "widgets", pattern: "src/widgets/**" },
  { type: "features", pattern: "src/features/**" },
  { type: "entities", pattern: "src/entities/**" },
  { type: "shared", pattern: "src/shared/**" },
];

const fsdRules = [
  { from: { type: "app" },      allow: { to: { type: ["widgets", "features", "entities", "shared"] } } },
  { from: { type: "widgets" },  allow: { to: { type: ["features", "entities", "shared"] } } },
  { from: { type: "features" }, allow: { to: { type: ["entities", "shared"] } } },
  { from: { type: "entities" }, allow: { to: { type: ["shared"] } } },
  { from: { type: "shared" },   allow: { to: { type: ["shared"] } } },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": fsdLayers,
      "boundaries/include": ["src/**/*"],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        { default: "disallow", rules: fsdRules },
      ],
    },
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
]);

export default eslintConfig;
