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

  if (!params.name.trim() || params.name.trim().length < 2) {
    errors.name = 'Please enter your full name.';
  }

  if (!params.email.trim() || !EMAIL_REGEX.test(params.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!params.phone.trim()) {
    errors.phone = 'Please enter your phone number.';
  }

  if (params.orderType === 'delivery' && !params.hasDeliveryLocation) {
    errors.deliveryLocation = 'Please set your delivery location to continue.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
