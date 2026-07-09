# Design System — "Savanna"

A calm, high-trust design language for a safety-critical product. Nothing here is decorative.

## Principles

1. **Trust first.** Every screen a parent sees must feel like a bank statement: clear, precise, no surprises.
2. **Signal over decoration.** Colors carry meaning (safe/warning/danger), not vibe. Never use red for a "success primary".
3. **Density with breathing room.** Dispatchers scan tables all day; parents glance for 5 seconds. Both must work.
4. **Everything is a link or a button.** No mystery affordances. Focus rings are visible on every interactive element.
5. **Mobile-first at every breakpoint.** Half our users are parents on Android.
6. **Motion is a feedback signal.** ≤ 200ms transitions for state changes, no gratuitous entrance animations.

## Tokens

### Palette

Base surfaces use zinc (neutral-cool). Semantic hues have full 50–950 ramps generated in `tailwind.config.ts`.

| Role | Light | Dark | Purpose |
|---|---|---|---|
| `surface` | zinc-50 | zinc-950 | App background |
| `surface-2` | white | zinc-900 | Cards |
| `surface-3` | zinc-100 | zinc-800 | Muted regions, table zebra |
| `border` | zinc-200 | zinc-800 | 1px hairlines |
| `foreground` | zinc-900 | zinc-50 | Body text |
| `muted-foreground` | zinc-500 | zinc-400 | Secondary text |
| `primary` | emerald-600 | emerald-500 | Primary action, brand |
| `primary-foreground` | white | zinc-950 | Text on primary |
| `accent` | amber-500 | amber-400 | Fleet, in-progress, warnings |
| `danger` | rose-600 | rose-500 | SOS, destructive, incidents |
| `success` | emerald-600 | emerald-500 | Confirmed, delivered |
| `info` | sky-600 | sky-500 | Neutral status |

### Typography

- **UI** — Inter (system fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI"`)
- **Mono** — JetBrains Mono (for RFID tag UIDs, coordinates, timestamps)
- Scale: 12 · 14 · 16 · 18 · 20 · 24 · 30 · 36 · 48

### Radius, shadow, spacing

- Radius: `sm 4px`, `md 6px`, `lg 8px` (default), `xl 12px`, `2xl 16px`
- Shadow: `sm` for cards, `md` for menus, `lg` for modals — all with cooler zinc tint, not black
- Spacing: 4-based grid (Tailwind default)
- Container: max-w-7xl centered with `px-4 md:px-6 lg:px-8`

## Primitives (in `apps/web/src/components/ui`)

All primitives are **vendored** (copied source, not npm dependencies). Style with Tailwind + `class-variance-authority`. Composable, accessible defaults from Radix where relevant.

Available now:

- `<Button>` — variants: `default | primary | secondary | outline | ghost | destructive | link`. Sizes: `sm | md | lg | icon`.
- `<Input>` — text/email/password/number, with `invalid` + `disabled` styling.
- `<Label>` — pairs with `<Input>` via `htmlFor`.
- `<Card>`, `<CardHeader>`, `<CardTitle>`, `<CardDescription>`, `<CardContent>`, `<CardFooter>`.

Coming in M2:

- `<Table>`, `<Dialog>`, `<Sheet>`, `<Select>`, `<Combobox>`, `<Tabs>`, `<Badge>`, `<Avatar>`, `<Toast>` (sonner), `<Tooltip>`, `<DropdownMenu>`, `<Skeleton>`, `<Pagination>`, `<DatePicker>`, `<MapCanvas>` (react-leaflet wrapper).

## Layout patterns

### AppShell

```
┌──────────────────────────────────────────────────┐
│  Topbar — tenant switcher · search · user menu   │
├────────┬─────────────────────────────────────────┤
│        │                                         │
│ Side-  │   Page                                  │
│ bar    │   (breadcrumbs → title → actions        │
│        │    → content)                           │
│        │                                         │
└────────┴─────────────────────────────────────────┘
```

- Sidebar collapses to icons at `< md`.
- Topbar collapses hamburger + drawer at `< md`.

### Page composition

Every page has this order:
1. `<Breadcrumbs>` (optional)
2. `<PageHeader title actions>` — `title` on the left, primary actions on the right
3. Content — cards or tables, single column at `< md`, 12-column grid ≥ `md`

### Table pattern

- Sticky header, zebra rows (`odd:bg-surface-3/50`), horizontal scroll on overflow
- First column is identifier + link
- Right-aligned actions column with dropdown
- Empty state: illustration + one-line explanation + primary CTA

### Empty / loading / error states

Every data view must handle all three:

- **Loading** — `<Skeleton>` matching the eventual layout (never a spinner in-place of content)
- **Empty** — icon + friendly copy + primary CTA to create the first record
- **Error** — inline banner with retry; toast for transient errors

## Motion

- 150ms `ease-out` on hover / focus color transitions
- 200ms `ease-out` on layout shifts (drawer, dialog)
- Never animate opacity + transform + color together — pick one
- `prefers-reduced-motion` → transitions drop to 0ms

## Accessibility

- Every interactive element has a visible focus ring (`focus-visible:ring-2 focus-visible:ring-primary/60`)
- Color contrast ≥ 4.5:1 for body, ≥ 3:1 for large text
- Icons that carry meaning have `aria-label`
- Forms use `<label>` bound to `<input>`; errors are announced via `aria-describedby`
- Dialogs trap focus, restore on close, close on Escape
- Live regions (`aria-live="polite"`) for toast + SOS banner

## Dark mode

Toggle in the Topbar user menu. Persisted per-user in `localStorage.theme` (`light | dark | system`). CSS variables switch on `html.dark`.

## Do / Don't

| Do | Don't |
|---|---|
| Use `emerald` for the primary CTA | Use `rose` for anything non-destructive |
| Show a skeleton matching the final layout | Show a spinner in place of content |
| Left-align money in body, right-align in tables | Center-align numeric columns |
| Use ISO dates in tooltips, relative in body ("2 min ago") | Show raw timestamps to end users |
| Wrap RFID / device IDs in `<code>` (mono) | Mix mono and proportional inside the same cell |
| Reveal a 24-char UUID in a tooltip | Print full UUIDs in visible copy |
