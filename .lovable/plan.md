## Goal

When the selected time falls outside the chosen branch's working hours (e.g. branch closed at that time), the user must be visibly blocked from picking a table or proceeding with a booking.

## Current behavior
- `isOutsideWorkingHours()` already exists and a small red helper text shows under the Time input.
- `dateTimeValid` already excludes outside-hours times.
- BUT: the floor plan tables remain clickable (the per-table `handleTableClick` only checks pause + reservedIds, not `dateTimeValid`), and there's no prominent banner.

## Changes — `src/pages/TableBooking.tsx`

1. **Block table selection when out of hours**
   - In `handleTableClick`, add an early `if (!dateTimeValid) return;` so neither the floor-plan tap nor the list "Book Now" can open the booking dialog.

2. **Prominent closed-branch banner**
   - Right above the Date & Time grid (or directly under it), render a destructive alert when `isOutsideWorkingHours()` is true and `branch` is loaded:
     ```
     ⚠ {branch.name} is closed at {selectedTime}.
        Working hours: {opensAt} – {closesAt}. Please pick a time within working hours to book a table.
     ```
   - Style: `rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-3 sm:p-4 font-medium text-sm` — matches the existing "reservations paused" banner pattern already in the file.

3. **Update availability hint**
   - When out of hours, replace the current "Select a date & time to see availability" text with `Branch is closed at the selected time — choose another time.` for clarity.

4. **Visual cue on the floor plan**
   - Already handled: `dateTimeValid` is false ⇒ green "Available" / red "Reserved" labels are not rendered. Combined with the click guard, tapping a table simply does nothing. No further canvas changes needed.

## Out of scope
- No changes to `PartySizeDialog` (the time field there is also a free `<input type="time">`; we'll rely on the page-level banner since the dialog closes on confirm). If you want the same warning inside the popup, that's a quick follow-up.
- No DB / edge function changes — `create-booking` already validates working hours server-side.
