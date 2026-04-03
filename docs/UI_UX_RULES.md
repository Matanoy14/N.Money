# UI/UX Rules

## RTL Rules
- `dir="rtl"` on the outermost wrapper in App.tsx
- Sidebar is on the RIGHT (`right-0`, `lg:mr-[240px]` on main content)
- Flex rows flow right-to-left by default
- `text-right` is default — only override when needed
- Back/navigation arrows: use `‹` (visual left) for "go back" in RTL
- Panels: should slide from right (`right-0` panel). Some current panels are left-slide — known gap.
- `text-left` inside RTL containers = physical left = visual end. Use `text-center` or `text-right` for RTL-natural alignment.
- Internal nav: always React Router `<Link>` or `navigate()`, never `<a href="...">`

## Typography Hierarchy
| Level | Class | Use |
|---|---|---|
| Page title | `text-2xl font-extrabold text-gray-900` | Page `<h1>` |
| Card title | `font-bold text-gray-900` | Card `<h3>` |
| Section label | `text-[11px] font-bold uppercase tracking-widest text-gray-400` | Between sections |
| Body | `text-sm text-gray-700` | General content |
| Secondary | `text-sm text-gray-400` | Counts, subtitles |
| Micro label | `text-xs text-gray-500 font-semibold` | Form labels, pill labels |
| KPI number | `text-3xl font-extrabold` with `fontVariantNumeric: 'tabular-nums'` | KPI cards |

## Cards
- All cards: `bg-white rounded-2xl p-6`
- Shadow: `boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)'`
- No border needed when shadow is present
- Selected state: `border-2` with category/item color + light color bg tint (`color + '0D'`)

## Forms
- Input: `px-4 py-3 border border-gray-200 rounded-[10px] text-sm focus:outline-none focus:border-[#1E56A0] focus:ring-2 focus:ring-[#1E56A0]/20`
- Amount input: `text-2xl font-bold text-center`, larger padding
- Label: `text-sm font-semibold text-gray-700 mb-1.5`
- Error: `#FEF2F2` bg, `#E53E3E` text, `#FECACA` border
- Disabled: `opacity-50 cursor-not-allowed`

## CTAs / Buttons
- Primary: `bg-[#1E56A0] text-white rounded-[10px] px-5 py-2.5 font-semibold text-sm hover:opacity-90 active:scale-[0.98]`
- Primary shadow: `boxShadow: '0 2px 8px rgba(30,86,160,0.25)'`
- Secondary (outlined): `border border-gray-200 text-gray-700 bg-white`
- Destructive: `hover:bg-red-50 text-red-500`
- Filter pill (active): blue or source color, white text
- Filter pill (inactive): white bg, gray text, `border border-gray-200`
- Clear filter: `bg-[#E8F0FB] text-[#1E56A0] border border-[#1E56A0]/20 px-4 py-1.5 rounded-full`

## Charts
- Donut center: always show total amount + "סה״כ" label
- Legend: show amount + % (not % only)
- Tooltip: RTL direction, rounded-xl, shadow-lg
- Category colors: use `chartColor` from EXPENSE_CATEGORIES (not `color`)
- Dimming non-selected: `opacity: 0.35` on slices, `0.25–0.45` on bars/labels
- Bar charts: `layout="vertical"` for horizontal bars in RTL

## Labels / Hebrew Copy
- Empty states: icon (text-4xl) + message + CTA where useful
- Filter labels: prefix pills with micro-label `text-xs font-semibold text-gray-400` (e.g. "לפי תשלום:")
- Dates: always use `formatDate()` — never raw YYYY-MM-DD strings
- Currency: always use `formatCurrency()` — never raw `amount`
- Percentage: append `%` after number, use `fontVariantNumeric: 'tabular-nums'`

## Mobile / Responsive
- Desktop sidebar: `lg:flex` hidden below lg
- Mobile nav: `lg:hidden` bottom fixed bar, h-16
- Cards grid: `grid-cols-1 lg:grid-cols-2` for balanced two-column
- Table → cards on mobile: `hidden md:block` for table, `md:hidden` for mobile cards
- Bottom nav padding: `pb-24 lg:pb-8` on page content to avoid FAB overlap

## Spacing Rhythm
- Section mb: `mb-5` (standard between cards)
- Card padding: `p-6`
- Filter row mb: `mb-4`
- Input stack gap: `space-y-4`
- Attribution/ranking row gap: `space-y-2` or `space-y-2.5`
