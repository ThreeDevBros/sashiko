## Goal

After the user picks a branch, the popup currently asks only "How many people?". Extend it to also collect **Date** and **Time** in the same popup, mirroring the fields already shown on the page. The selected values feed straight into TableBooking's existing `selectedDate` / `selectedTime` state so reservation availability is computed immediately.

## Changes

### 1. `src/components/booking/PartySizeDialog.tsx`
Convert into a combined "Reservation details" popup:
- Keep the `Number of guests` field (mobile native `<select>` / desktop number input).
- Add a **Date** field — `Calendar` inside a `Popover` with a `CalendarIcon` trigger button (same pattern as `TableBooking.tsx`), disabling past dates.
- Add a **Time** field — same shadcn `Select` of 30-min slots used on the booking page (or reuse the native time picker on mobile for parity with current UX).
- New props: `selectedDate`, `onDateChange`, `selectedTime`, `onTimeChange`.
- "Find Available Tables" button stays disabled until guests + date + time are all set; clicking it calls `onConfirm()` and closes.
- Dialog title becomes "Reservation details" (or similar); icon row keeps `Users`.

### 2. `src/pages/TableBooking.tsx`
- Pass `selectedDate`, `setSelectedDate`, `selectedTime`, `setSelectedTime` into `PartySizeDialog`.
- The existing inline Date/Time fields on the page remain (so the user can tweak afterward) — they share the same state, so edits in either place stay in sync.
- Open flow stays: branch dialog closes → `setPartySizeDialogOpen(true)` (already wired in `handleBranchDialogClose`).

### 3. i18n
Add any new strings ("Date", "Time", "Pick a date", "Reservation details") to `src/i18n/locales/en.json` and `el.json` if existing labels in PartySizeDialog are translated. (Current file uses hard-coded English, so we'll keep it consistent and not introduce i18n unless requested.)

## Out of scope
- No DB / edge function changes — all state already flows into the existing reservation query.
- No changes to `BookingDialog` (final confirmation step).
