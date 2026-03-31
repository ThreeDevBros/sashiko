

# Remove Price/Time from Popular Items & Navigate to Item Detail

## Overview
On the homepage, popular item cards currently show a price badge and preparation time overlay. These will be removed. When a user taps a popular item, they'll navigate to `/order?item={itemId}`, and the MenuDisplay component will auto-open that item's detail sheet.

## Changes

### 1. Homepage Popular Items (`src/pages/Index.tsx`)
- Remove the price `Badge` overlay (lines 293-295)
- Remove the preparation time `Clock` overlay (lines 296-303)
- Change the `onClick` from `navigate('/order')` to `navigate(`/order?item=${item.id}`)`

### 2. MenuDisplay Auto-Open Item (`src/components/MenuDisplay.tsx`)
- Read `item` query param via `useSearchParams`
- When menu items are loaded and the query param is present, find the matching item and auto-open the `MenuItemDetailSheet`
- Clear the query param after opening so it doesn't re-trigger

### 3. Import Cleanup (`src/pages/Index.tsx`)
- Remove `Clock` from lucide-react imports if no longer used elsewhere
- Remove `Badge` import if no longer used elsewhere in the file

