# Business OS design language

## Foundation

Use a quiet slate workspace with white surfaces and indigo for the main action. The navigation is a light persistent rail, allowing customer content to carry the visual weight. Avoid large introductory blocks above working tables, decorative metrics, and inactive navigation for unavailable modules.

Tokens live in `src/app/globals.css`: canvas `#f6f7fb`, surface `#ffffff`, text `#202536`, borders `#e7e9f0`, primary `#5146df`, primary hover `#4338ca`, primary surface `#efedff`. Secondary text uses `#6b7280` on light surfaces. Prospect uses violet, active uses green, inactive uses gray; status always includes a text label so meaning does not depend on color alone.

Use a system sans-serif stack, 24–30px page titles, 14–16px working content, and 12–13px supporting metadata. Keep forms at 16px to support mobile browsers. Use a 4px spacing scale, restrained borders, 8px controls and 12px panels. Icons are small consistent strokes; icon-only controls need names and tooltips.

## Layout and behavior

- Desktop sidebar: 248px; collapses to an 80px icon rail. Below 768px it becomes a native modal drawer with focus containment, Escape dismissal and focus restoration.
- Content is fluid with a 1560px centered maximum; a topbar control permits full width. Navigation remains usable with long organization names.
- Sidebar, content width and customer view preferences persist locally as device preferences. Authentication tokens are never stored with them.
- Customer tables have fixed column allocation and truncate long names with full text available through the link title. Mobile uses customer cards; desktop offers table/card selection.
- Forms group company details, contact information and ownership with actions in a distinct footer. Labels stay accessible when fields contain values.
- Use the shared buttons, fields, icon component, pagination and status badge. Preserve visible focus indicators and respect reduced-motion preferences.

## Verification

Run lint, type checking, production build and Playwright. UI tests cover sidebar collapse across navigation, full-width mode, table/card switching, mobile navigation, Escape/focus restoration, mobile form fit, and the existing customer/account workflows.

## Opportunity workflow

The opportunity directory follows the same typography, surfaces and actions as Customers. The pipeline scrolls horizontally within the content area; columns load and paginate independently. Stage names come from the API. Closed-won and closed-lost states use the existing semantic colors and text labels. Values display their own currency; currencies are not added together.

Opportunity forms group customer requirements, pipeline/value fields and the next action. Details show the linked customer, value, probability, close date and owner above a shared activity timeline. Administrators and sales managers can add, rename and order stages through Pipeline settings. Mobile list mode uses cards; the board preserves horizontal scrolling without widening the document.

## Quotes and products

The product catalogue uses compact cards with currency-specific prices. Quote editing keeps details and items in the main column with a sticky total summary on wide screens; the summary follows the form on smaller screens. Each line groups quantity, price and discount, with exact live totals. Quote detail uses status labels, an explicit next action and approval history. Mobile tables become item cards.

The downloadable quote uses a standard A4 template with the same slate/indigo palette, embedded DejaVu Sans fonts and simple line-item sections that continue across pages. Quote and product values remain visible in their selected currency without implied conversion.

## Delivery projects and tasks

Delivery uses responsive project cards with semantic status labels, task progress, owners and target dates. Project details keep tasks in the main column with status and source context alongside on desktop and below on mobile. Progress always includes a percentage and completed/total task text.

Tasks group title, assignee, priority and due date with named status controls. Overdue text supplements color. Status and Assigned to me filters keep daily work easy to find. Completion is explicit, and the interface explains that a completed project must be reopened before task changes.

## Finance

Finance uses currency-specific metric rows and responsive invoice cards. Draft, issued, sent, partially paid, paid and overdue always display text labels. Invoice detail keeps saved items and payment history in the main column, with the next action and source context alongside. Form groups separate quote selection from invoice dates/tax/notes. Issuing and recording delivery are distinct actions. Payment entry explains that it records money already received.

## Shared service scopes

Service scope cards show customer, revision, status and contribution count. Contribution cards group deliverables, assumptions, exclusions and timeline with an explicit team and last editor. The review sidebar explains the next available action and editing locks. Approved revisions open as read-only snapshots with a clear return to the current scope. Mobile forms stack fields without widening the document.

## Documents

Reuse the shared card grid, page heading and responsive editor split. Show a compact file-format label, explicit intake status, workspace, uploader and file size. Use the native accessible file picker; keep upload and review feedback next to their forms. Explain intake acceptance separately from legal/financial approval. Preserve original filenames as wrapping text and keep fingerprints in a wrapping monospace field.

## Business Overview

Use separate currency cards for financial values and a two-column tasks/activity layout that stacks below 900px. Keep stage charts to deal counts so no currency amounts are mixed. Show freshness, UTC task-date semantics and explicit empty/error states. Keep account/permission details in a collapsed panel so operational information leads.

## Notifications

Use the existing slate/indigo language: unread cards have a narrow indigo edge, explicit state labels, clear record/read actions and responsive stacked controls. Inbox and personal reminders are separate views. Keep personal reminder time semantics visible beside the form; the header bell is keyboard-accessible and updates only while the page is visible.
