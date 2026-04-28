---
description: 'Use when writing or refactoring React code, React example snippets, or framework demo code in apps/framework-demo and apps/storybook-react. Covers file naming, component folder structure, nesting rules, export patterns, and hook composition style.'
applyTo: 'apps/framework-demo/src/**/*.{ts,tsx}, apps/storybook-react/**/*.{ts,tsx,mdx}'
---

# React Framework Guidelines

- Match React example code and framework demo code to the user's React coding style and standards.
- When examples in `apps/storybook-react` describe implementation, keep them aligned with the actual React source in `apps/framework-demo`.
- Never use `any` in TypeScript/TSX. Prefer explicit interfaces, generics, discriminated unions, or `unknown` with narrowing.

## File Naming

- Component files: `Name.component.tsx`
- Hook files follow: `use<Purpose>.<hookType>.ts` or `use<Purpose>.<hookType>.tsx`
- Hook type suffixes should be explicit and consistent (for example: `.memo`, `.callback`, `.effect`, `.context`).
- Prefer these examples as canonical naming:
  - `useCdgPlayer.context.ts`
  - `useLoadTrack.callback.ts`
  - `useOnFieldChange.effect.ts`
  - `useFilePickerRowProps.memo.tsx`
- Function files: `name.function.ts`
- Constant files: `name.constant.ts`
- Type files: `name.type.ts`
- Keep constants and pure utilities in dedicated files instead of embedding them in component render files.

## Folder Structure

- Prefer component folders over monolithic React files.
- Top-level reusable components belong under `src/app/components/ComponentName/`.
- Parent-only implementation details belong under `src/app/components/ParentName/components/SubComponentName/`.
- Each component folder should prefer:
  - `ComponentName.component.tsx`
  - `ComponentName.module.css`
  - `index.ts`
  - `hooks/` when needed
  - `components/` for parent-owned subcomponents

## CSS Expectations

- Prefer baseline-2024 CSS features, including native nested CSS and CSS layers.
- For component and interface styling, use CSS Modules (`.module.css`) by default.
- Keep selectors locally scoped to the component module; avoid broad global selectors in React component work.
- Avoid inline styles except for one-off prototyping, CSS custom properties, or intentionally shared utility cases.
- If an area still uses existing shared/global styles, avoid broad rewrites and migrate incrementally when touching related components.
- In React work, only treat these as acceptable shared/global CSS exceptions:
  - Theme/design tokens via root-level CSS custom properties.
  - Reset/base element styles applied once at app entry.
  - App-shell utility classes intentionally reused across routes/features.
  - Required global selectors for third-party library integration points.

## Component Nesting Rules

- If a component is only used by one parent, nest it under that parent's `components/` folder.
- If a component is reused across screens, routes, or parents, keep it as a top-level component.
- Sections, cards, rows, headers, and item renderers are usually parent-owned subcomponents.

## Component Pattern

- Export prop types near the top of the component file.
- Define components as named functions, not arrow-function component constants, unless an existing local pattern requires otherwise.
- Default export the component at the bottom.

```tsx
export type ExampleProps = {
  label: string;
};

function Example({ label }: ExampleProps) {
  return <div>{label}</div>;
}

export default Example;
```

## Barrel Exports

- Use folder-level `index.ts` barrel exports.
- Export reusable developer-facing utilities/types intentionally through barrel files after validating naming, tests, and docs.

```ts
export { default } from './Example.component';
export type { ExampleProps } from './Example.component';
```

## Hook Composition

- Keep render files focused on rendering.
- For non-trivial behavior, compose one top-level hook that assembles smaller hooks and returns resolved props.
- Prefer patterns like `useComponentNameProps.memo.ts(x)` that compose helper hooks following `use<Purpose>.<hookType>.ts(x)` naming.

## Component Hook Pattern

- For each non-trivial component, prefer a colocated hook under `hooks/` named `use<ComponentName>Props.memo.tsx`.
- Treat `*.component.tsx` files as render-first files:
  - No embedded async workflows.
  - No embedded event business logic.
  - No inline parsing/validation branches beyond trivial JSX glue.
- Put callback/event behavior in hook files and expose stable handlers/derived values through resolved props.
- Keep parsing and command-style calls in the owning component hook, not in parent orchestration hooks.
- If behavior belongs to one UI control (file picker, transport, settings), colocate it in that control's hook.
- If behavior is shared by multiple components, move only the shared primitive/state to context or a shared hook; keep control-specific handlers local.

## Context Boundary

- Context should provide shared state, shared refs, and cross-cutting helpers only.
- Do not put control-owned handlers in context when those handlers are only consumed by one component.
- Promote logic into context only after a second concrete consumer appears, or when synchronization across multiple components is required.

## Practical Guidance For This Repo

- Avoid growing `apps/framework-demo/src/App.tsx` with more mixed rendering and orchestration logic.
- When the framework demo grows, prefer extracting React UI into component folders that follow the naming and nesting rules above.
- Keep React example snippets consistent with these conventions rather than using simplified ad hoc file shapes.
- In `apps/framework-demo/src/app/components/FrameworkDemo/components/*`, pair each subcomponent with a colocated `hooks/use<ComponentName>Props.memo.tsx` when it has non-trivial handlers.
