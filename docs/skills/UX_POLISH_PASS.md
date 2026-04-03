# Skill: UX Polish Pass

Use for targeted visual/UX improvement passes. Not a full redesign.

## Scope Definition
Before starting, answer:
- Which specific elements need improvement?
- What is the exact complaint (spacing / hierarchy / readability / color)?
- What is explicitly NOT being changed?

## Polish Checklist

### Hierarchy
- [ ] Is there a clear primary value (large, bold)?
- [ ] Is secondary info visually subordinate (smaller, gray)?
- [ ] Are section titles consistent (`font-bold text-gray-900`)?
- [ ] Is there breathing room between sections?

### Spacing
- [ ] Are margins consistent (`mb-5` between cards, `mb-4` between filter rows)?
- [ ] Is there awkward dead space (double margins, my-N + mb-N stacked)?
- [ ] Does the card padding feel right (`p-6`)?

### Typography
- [ ] Numbers use `fontVariantNumeric: 'tabular-nums'`?
- [ ] Currency always via `formatCurrency()`?
- [ ] Dates always via `formatDate()`?
- [ ] Hebrew labels are natural and concise?

### Colors
- [ ] Primary actions: `#1E56A0`
- [ ] Chart colors: using `chartColor`, not `color`
- [ ] Empty/disabled states: gray-400, not invisible

### RTL
- [ ] `text-left` inside RTL containers? (change to `text-center` or `text-right`)
- [ ] Panel slides from right (`right-0` in RTL)?
- [ ] Back button uses `‹` (not `→`)?
- [ ] Internal nav uses `<Link>` not `<a href>`?

### Interactivity
- [ ] Hover states on clickable elements
- [ ] Active/selected state clearly visible
- [ ] Disabled state for buttons that can't be clicked

## Anti-Patterns to Avoid
- Removing working data logic to "clean up"
- Adding visual complexity that doesn't aid understanding
- Making cards taller to fill space
- Adding charts that duplicate adjacent information
- Touching unrelated sections while polishing one card
