# Global UI Styling Instruction

Whenever implementing a new UI page or modifying existing UI components in the Heroic AI RPG project, you MUST follow this styling guide. This guide is derived from the project's global CSS and brand standards.

## Brand Standards
- **Title Casing**: Always use Title Casing for all text, titles, and labels.
- **No All-Caps**: Never use uppercase-only styling for titles or interactive elements.
- **Mobile First**: Implement responsive layouts starting with mobile views.
- **Consult `globals.css`**: Always prioritize using the CSS variables and utility classes defined in `src/app/globals.css`.

## Color Palette
Use these brand variables for consistency:
- **Background**: `bg-brand-bg` (`#0A0A0A`)
- **Surface**: `bg-brand-surface` (`#1C1C1E`) / `bg-brand-surface-raised` (`#2C2C2E`)
- **Accent**: `text-brand-accent` / `bg-brand-accent` (`#3ecf8e` - Mint Green)
- **Text**: `text-brand-text` (`#E5E5E7`) / `text-brand-text-muted` (`#8E8E93`)
- **Status**: `text-status-hp`, `text-status-stamina`, etc.

## Typography
- **Titles (H1-H3)**: Use `h1`, `h2`, or `h3` tags. They use the `Merriweather` serif font and a unified `23px` size.
- **Sections (H4)**: `19px`, Sans-serif, Bold.
- **Sub-sections (H5)**: `15px`, Sans-serif, Bold.
- **Body Text**: Use `.text-body-base` (15px) for standard content.

## Component Classes
- **Buttons**:
  - Primary: `.btn-primary` (Mint BG)
  - Secondary: `.btn-secondary` (Mint Border)
  - Tertiary: `.btn-tertiary` (Ghost/Muted)
  - Sizes: `.btn-lg` (56px), `.btn-md` (44px), `.btn-sm` (32px)
- **Containers**:
  - Cards: `.card-base` or `.card-raised` (16px radius)
  - Layout: `animate-page` for entry animations.

## Implementation Checklist
1. Are all titles in Title Casing?
2. Is there any forbidden ALL CAPS text?
3. Does the layout work well on mobile?
4. Are `btn-primary`, `card-base`, etc., being used instead of ad-hoc styles?
5. Is `brand-accent` used for the primary call-to-action?
