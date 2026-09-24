import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

/*
 * The design system is enforced by the build, not by review.
 *
 * Every rule below exists because the same class of drift got in and stayed in:
 * 42 hand-typed font sizes, 3 arbitrary radii, 23 hardcoded chart colours, a
 * second neutral ramp, and a set of animation classes whose plugin was never
 * installed. A system that lives only in a document degrades; one the build
 * checks does not.
 */
const DESIGN_SYSTEM_RULES = [
  {
    // text-[0.82rem], rounded-[20px], p-[13px] — off every scale by definition.
    //
    // Width and height are deliberately absent: a chart's pixel height or a
    // viewport calc has no scale to be on. Layout constants that repeat get a
    // named token instead — w-rail, max-w-content, h-screen-content.
    selector:
      'JSXAttribute[name.name="className"] Literal[value=/\\b(?:text|rounded|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|space-x|space-y|leading|tracking)-\\[/]',
    message:
      'Arbitrary Tailwind value. Use the design scale: text-xs/label/sm/base/lg/2xl/3xl, rounded-sm/md/lg, and spacing 1/2/3/4/6/8/12.',
  },
  {
    // Raw hex belongs in the token file, not in a component or a chart.
    selector: 'JSXAttribute[name.name="className"] Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
    message: 'Hardcoded colour. Use a token utility (bg-primary, text-muted-foreground, border-border).',
  },
  {
    // slate was a second neutral ramp beside gray. One ramp only.
    selector:
      'JSXAttribute[name.name="className"] Literal[value=/\\b(?:bg|text|border|ring|divide|from|to|via)-slate-[0-9]/]',
    message: 'The product has one neutral ramp: gray. Use gray-* or a token utility.',
  },
  {
    // tailwindcss-animate is not a dependency; these classes emit nothing.
    selector:
      'JSXAttribute[name.name="className"] Literal[value=/\\b(?:animate-in|animate-out|slide-in-from-|zoom-in-|zoom-out-)/]',
    message: 'tailwindcss-animate is not installed — these classes render nothing. Remove them.',
  },
  {
    // `title` is not an accessible name and never appears on touch.
    // A tooltip is fine; a tooltip *instead of* a name is not.
    selector:
      'JSXOpeningElement[name.name="button"]:not(:has(JSXAttribute[name.name="aria-label"])):not(:has(JSXAttribute[name.name="aria-labelledby"])) > JSXAttribute[name.name="title"]',
    message: 'Give icon-only buttons an aria-label. `title` is not an accessible name.',
  },
  {
    // A raw form control with no accessible name is announced as nothing.
    // Prefer the Input/Select/Checkbox components, which bind their own label;
    // where a raw control is genuinely right, give it an aria-label.
    selector:
      'JSXOpeningElement[name.name=/^(input|select|textarea)$/]:not(:has(JSXAttribute[name.name="aria-label"])):not(:has(JSXAttribute[name.name="aria-labelledby"])):not(:has(JSXAttribute[name.name="id"])):not(:has(JSXAttribute[name.name="aria-hidden"])):not(:has(JSXAttribute[name.name="type"][value.value="hidden"]))',
    message:
      'Form control with no accessible name. Use Input/Select/Checkbox, or add an aria-label.',
  },
  {
    // The status vocabulary lives in StatusBadge. A local colour map drifts.
    selector: 'VariableDeclarator[id.name=/^status(Colors?|Map|Styles)$/]',
    message: 'Status colours live in StatusBadge. Add the status there, not here.',
  },
];

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': ['warn', ...DESIGN_SYSTEM_RULES],
    },
  },
  {
    // The token file and the design-system primitives are where the raw values
    // legitimately live.
    files: ['src/components/ui/**', 'src/utils/chartTheme.ts', 'tailwind.config.js'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
]);
