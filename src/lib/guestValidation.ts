export interface GuestValidationErrors {
  name?: string;
  email?: string;
  phone?: string;
  deliveryLocation?: string;
}

export interface GuestValidationResult {
  isValid: boolean;
  errors: GuestValidationErrors;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateGuestCheckout(params: {
  name: string;
  email: string;
  phone: string;
  orderType: 'delivery' | 'pickup';
  hasDeliveryLocation: boolean;
}): GuestValidationResult {
  const errors: GuestValidationErrors = {};

  // Values are presence flags only — the UI communicates the problem with a red
  // outline and red label instead of an error sentence.
  if (!params.name.trim() || params.name.trim().length < 2) {
    errors.name = 'invalid';
  }

  if (!params.email.trim() || !EMAIL_REGEX.test(params.email.trim())) {
    errors.email = 'invalid';
  }

  if (!params.phone.trim()) {
    errors.phone = 'invalid';
  }

  if (params.orderType === 'delivery' && !params.hasDeliveryLocation) {
    errors.deliveryLocation = 'invalid';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
