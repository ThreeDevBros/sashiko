import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar, Clock, Users, MapPin, Store, Phone, MessageSquare, ExternalLink, Loader2
} from 'lucide-react';
import googleMapsIcon from '@/assets/google-maps-icon.png';

interface ReservationDetail {
  id: string;
  branch_name: string;
  branch_phone: string;
  branch_address: string;
  branch_latitude?: number;
  branch_longitude?: number;
  reservation_date: string;
  start_time: string;
  end_time: string;
  party_size: number;
  status: string;
  special_requests: string | null;
  created_at: string;
}

interface ReservationDetailSheetProps {
  reservation: ReservationDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatTime = (time: string) => {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const formatStatus = (status: string) =>
  status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const getStatusColor = (status: string, isVisited: boolean) => {
  if (isVisited) return 'bg-green-600';
  const colors: Record<string, string> = {
    pending: 'bg-yellow-500',
    confirmed: 'bg-blue-500',
    cancelled: 'bg-red-500',
    no_show: 'bg-red-400',
    completed: 'bg-green-600',
    rejected: 'bg-red-600',
  };
  return colors[status] || 'bg-muted';
};

export function ReservationDetailSheet({ reservation, open, onOpenChange }: ReservationDetailSheetProps) {
  if (!reservation) return null;

  const now = new Date();
  const endDateTime = new Date(`${reservation.reservation_date}T${reservation.end_time}`);
  const hasEnded = now > endDateTime;
  const isUpcoming = ['pending', 'confirmed'].includes(reservation.status) && !hasEnded;
  const isVisited = reservation.status === 'confirmed' && hasEnded;

  const statusLabel = isVisited ? 'Visited' : formatStatus(reservation.status);
  const statusColor = getStatusColor(reservation.status, isVisited);

  const reservationDate = new Date(reservation.reservation_date + 'T00:00:00');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl p-0">
        <div className="pb-8">
          {/* Header */}
          <SheetHeader className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg">Reservation Details</SheetTitle>
              <Badge className={`${statusColor} text-white`}>
                {statusLabel}
              </Badge>
            </div>
          </SheetHeader>

          <div className="px-5 space-y-5 mt-5">
            {/* Overview */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Overview</h3>
              <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Date</span>
                  </div>
                  <span className="text-sm font-medium">
                    {reservationDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Time</span>
                  </div>
                  <span className="text-sm font-medium">
                    {formatTime(reservation.start_time)} – {formatTime(reservation.end_time)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Party Size</span>
                  </div>
                  <span className="text-sm font-medium">
                    {reservation.party_size} {reservation.party_size === 1 ? 'guest' : 'guests'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Branch</span>
                  </div>
                  <span className="text-sm font-medium">{reservation.branch_name}</span>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            {reservation.special_requests && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Special Requests</h3>
                  <div className="bg-muted/40 rounded-xl p-4">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm italic text-muted-foreground">"{reservation.special_requests}"</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Booking Info */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Booking Info</h3>
              <div className="bg-muted/40 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Booked on</span>
                  </div>
                  <span className="text-sm font-medium">
                    {new Date(reservation.created_at).toLocaleDateString()} at{' '}
                    {new Date(reservation.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Restaurant Info */}
            <Separator />
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Restaurant</h3>
              <div className="bg-muted/40 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{reservation.branch_name}</span>
                </div>
                {reservation.branch_address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{reservation.branch_address}</span>
                  </div>
                )}
                {reservation.branch_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{reservation.branch_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {reservation.branch_phone && (
                <a href={`tel:${reservation.branch_phone}`} className="block">
                  <Button variant="outline" className="w-full gap-2">
                    <Phone className="h-4 w-4" />
                    Call Restaurant
                  </Button>
                </a>
              )}

              {reservation.branch_latitude && reservation.branch_longitude && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${reservation.branch_latitude},${reservation.branch_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full gap-3">
                    <img src={googleMapsIcon} alt="Google Maps" className="h-5 w-5 object-contain" />
                    Open in Maps
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
