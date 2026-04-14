

## Add `/support` Page

A simple public page that tells users to contact any branch for support, displaying branch contact details (phone, address) fetched from the database.

### Files to create/modify

1. **`src/pages/Support.tsx`** (new) — A simple page showing:
   - Heading: "Contact Support"
   - Message: "For any questions or issues, please contact any of our branches directly."
   - A list of all branches with their name, phone number, and address (fetched from the `branches` table)
   - Each phone number is a clickable `tel:` link
   - Uses `pt-safe` for iOS safe area consistency
   - Styled consistently with other pages (Card components, same layout patterns)

2. **`src/App.tsx`** — Add route:
   - Lazy import `Support` page
   - Add `<Route path="/support" element={...} />` alongside the other public routes

### Result
- `/support` URL is publicly accessible (no auth required)
- Shows branch contact info so users can reach out directly
- Can be submitted as the Support URL in App Store Connect

