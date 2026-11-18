# The design system is Base UI under plain CSS with custom properties, handed to plugins by the host

The UI's components live in `packages/ui/src/core/ui/`, one folder per component. Menus, dialogs, tooltips and tabs are built on Base UI (`@base-ui/react`), which brings focus handling, keyboard navigation and dismissal; every look comes from a plain CSS file in each component's folder. Every colour, size, radius and duration is a `--iv-` CSS custom property from `core/theme/tokens.css`, so a theme file (`~/.ivin/themes/<id>.json`, colours plus CSS) changes the whole app by overriding variables, with no build step. The built-in theme is "forest", in a dark and a light variant; the window follows the system appearance unless `data-theme` forces one.

Plugins import only `@ivin/plugin-api` and `react`. The plugin API declares each component's props and renders the component the host passes through `UiHostProvider`, so a plugin gets the same components as the built-in screens without importing a UI library, and the host's components are checked against those props at compile time. The components take data (a menu's items, a dialog's title and actions) rather than compound children, because a compound API cannot be passed through the host without exposing the library under it.

## Considered options

- **Tailwind with cva**: rejected because Tailwind only generates the classes it finds at build time, so a plugin compiled on load by Rolldown would use classes that do not exist unless every plugin compile ran Tailwind too, and a user theme's CSS would have no stable class to target. Tailwind only inside `packages/ui` was rejected too: built-in screens would then be styled one way and plugins another.
- **CSS modules**: rejected because hashed class names cannot be targeted by a user theme's CSS.
- **Radix primitives**: rejected in favour of Base UI, the `pick-ui-library` pick for unstyled accessible components.
- **Plugins importing the components from `@ivin/ui`**: rejected because a plugin may import only `@ivin/plugin-api` and `react` (ADR-0001's enforced imports), and one copy of each component must exist at runtime.

## Consequences

- Icons come from `lucide-react` behind an `Icon` component that takes a name from a fixed list, so a plugin names an icon without importing the library. The list grows when a feature needs a new icon.
- A component a plugin needs is added to the plugin API's `HostComponents` and supplied in `app/plugin-host.tsx`; until then it stays internal to the UI.
- Screens and plugins carry no inline styles: layout goes through `Stack`, `Block` and the other components, or a CSS file beside the screen.
