import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { GuestValidationErrors } from "@/lib/guestValidation";

interface GuestCheckoutFormProps {
  guestInfo: {
    name: string;
    email: string;
    phone: string;
  };
  onGuestInfoChange: (info: { name: string; email: string; phone: string }) => void;
  errors?: GuestValidationErrors;
}

export const GuestCheckoutForm = ({ guestInfo, onGuestInfoChange, errors }: GuestCheckoutFormProps) => {
  return (
    <Card className="p-6 mb-6" data-section="guest-info">
      <h2 className="text-lg font-semibold mb-4">Guest Information</h2>
      <p className="text-sm text-muted-foreground mb-4">
        We need your contact information to process your order
      </p>
      <div className="space-y-4">
        <div data-field="guest-name">
          <Label htmlFor="guest-name">
            Full Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="guest-name"
            type="text"
            value={guestInfo.name}
            onChange={(e) => onGuestInfoChange({ ...guestInfo, name: e.target.value })}
            placeholder="John Doe"
            required
            className={errors?.name ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors?.name && (
            <p className="text-sm text-destructive mt-1">{errors.name}</p>
          )}
        </div>
        <div data-field="guest-email">
          <Label htmlFor="guest-email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="guest-email"
            type="email"
            value={guestInfo.email}
            onChange={(e) => onGuestInfoChange({ ...guestInfo, email: e.target.value })}
            placeholder="john@example.com"
            required
            className={errors?.email ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors?.email && (
            <p className="text-sm text-destructive mt-1">{errors.email}</p>
          )}
        </div>
        <div data-field="guest-phone">
          <Label htmlFor="guest-phone">
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input
            id="guest-phone"
            type="tel"
            value={guestInfo.phone}
            onChange={(e) => onGuestInfoChange({ ...guestInfo, phone: e.target.value })}
            placeholder="+1 234 567 8900"
            required
            className={errors?.phone ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
          {errors?.phone && (
            <p className="text-sm text-destructive mt-1">{errors.phone}</p>
          )}
        </div>
      </div>
    </Card>
  );
};
