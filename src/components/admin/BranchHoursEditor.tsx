import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { BranchHours } from '@/types';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface BranchHoursEditorProps {
  hours: BranchHours[];
  onChange: (hours: BranchHours[]) => void;
}

function getDefaultHours(): BranchHours[] {
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    is_closed: false,
    is_24h: false,
    open_time: '09:00',
    close_time: '22:00',
    delivery_open_time: '09:00',
    delivery_close_time: '22:00',
    delivery_enabled: true,
  }));
}

export function getInitialHours(existing?: BranchHours[]): BranchHours[] {
  const defaults = getDefaultHours();
  if (!existing || existing.length === 0) return defaults;
  return defaults.map(d => {
    const match = existing.find(e => e.day_of_week === d.day_of_week);
    return match ? { ...d, ...match } : d;
  });
}

export function BranchHoursEditor({ hours, onChange }: BranchHoursEditorProps) {
  const updateDay = (dayIndex: number, updates: Partial<BranchHours>) => {
    const newHours = hours.map(h =>
      h.day_of_week === dayIndex ? { ...h, ...updates } : h
    );
    onChange(newHours);
  };

  const setAll24h = () => {
    onChange(hours.map(h => ({ ...h, is_24h: true, is_closed: false })));
  };

  const copyToAll = (dayIndex: number) => {
    const source = hours.find(h => h.day_of_week === dayIndex);
    if (!source) return;
    onChange(hours.map(h => ({
      ...h,
      is_closed: source.is_closed,
      is_24h: source.is_24h,
      open_time: source.open_time,
      close_time: source.close_time,
      delivery_open_time: source.delivery_open_time,
      delivery_close_time: source.delivery_close_time,
      delivery_enabled: source.delivery_enabled,
    })));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Operating Hours</Label>
        <button
          type="button"
          onClick={setAll24h}
          className="text-xs text-primary hover:underline"
        >
          Set all 24/7
        </button>
      </div>

      <Accordion type="multiple" className="w-full">
        {hours.map((day) => (
          <AccordionItem key={day.day_of_week} value={`day-${day.day_of_week}`} className="border rounded-lg mb-1 px-3">
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              <div className="flex items-center gap-2 w-full">
                <span className="font-medium w-24 text-left">{DAY_NAMES[day.day_of_week]}</span>
                <span className="text-xs text-muted-foreground">
                  {day.is_closed ? 'Closed' : day.is_24h ? '24 Hours' : `${day.open_time || '—'} – ${day.close_time || '—'}`}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3 space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.is_closed}
                    onCheckedChange={(v) => updateDay(day.day_of_week, { is_closed: v, is_24h: false })}
                  />
                  <span className="text-xs">Closed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.is_24h}
                    disabled={day.is_closed}
                    onCheckedChange={(v) => updateDay(day.day_of_week, { is_24h: v })}
                  />
                  <span className="text-xs">24 Hours</span>
                </div>
              </div>

              {!day.is_closed && !day.is_24h && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Open</Label>
                    <Input
                      type="time"
                      value={day.open_time || ''}
                      onChange={(e) => updateDay(day.day_of_week, { open_time: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Close</Label>
                    <Input
                      type="time"
                      value={day.close_time || ''}
                      onChange={(e) => updateDay(day.day_of_week, { close_time: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Delivery hours */}
              {!day.is_closed && (
                <div className="border-t pt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={day.delivery_enabled}
                      onCheckedChange={(v) => updateDay(day.day_of_week, { delivery_enabled: v })}
                    />
                    <span className="text-xs font-medium">Delivery</span>
                  </div>
                  {day.delivery_enabled && !day.is_24h && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Delivery Open</Label>
                        <Input
                          type="time"
                          value={day.delivery_open_time || day.open_time || ''}
                          onChange={(e) => updateDay(day.day_of_week, { delivery_open_time: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Delivery Close</Label>
                        <Input
                          type="time"
                          value={day.delivery_close_time || day.close_time || ''}
                          onChange={(e) => updateDay(day.day_of_week, { delivery_close_time: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => copyToAll(day.day_of_week)}
                className="text-xs text-primary hover:underline"
              >
                Apply to all days
              </button>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
