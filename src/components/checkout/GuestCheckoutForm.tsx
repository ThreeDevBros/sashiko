import { FloatingLabelInput } from "@/components/checkout/FloatingLabelField";
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
    <section className="py-6 border-b border-border/50" data-section="guest-info">
      <h2 className="font-display text-lg font-semibold tracking-tight mb-5">Guest Information</h2>

      <div className="space-y-4">
        <FloatingLabelInput
          data-field="guest-name"
          id="guest-name"
          label="Full Name"
          requiredHint="Required"
          type="text"
          autoComplete="name"
          value={guestInfo.name}
          onChange={(e) => onGuestInfoChange({ ...guestInfo, name: e.target.value })}
          required
          error={errors?.name}
        />
        <FloatingLabelInput
          data-field="guest-email"
          id="guest-email"
          label="Email"
          requiredHint="Required"
          type="email"
          autoComplete="email"
          value={guestInfo.email}
          onChange={(e) => onGuestInfoChange({ ...guestInfo, email: e.target.value })}
          required
          error={errors?.email}
        />
        <FloatingLabelInput
          data-field="guest-phone"
          id="guest-phone"
          label="Phone"
          requiredHint="Required"
          type="tel"
          autoComplete="tel"
          value={guestInfo.phone}
          onChange={(e) => onGuestInfoChange({ ...guestInfo, phone: e.target.value })}
          required
          error={errors?.phone}
        />
      </div>
    </section>
  );
};
