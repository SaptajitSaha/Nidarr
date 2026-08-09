import { normalizeDialablePhoneNumber } from './phoneNumber';

export const buildTelephoneHref = (phone: string) => {
  const dialablePhone = normalizeDialablePhoneNumber(phone);
  return dialablePhone ? `tel:${dialablePhone}` : null;
};

export const openTelephoneDialer = (phone: string) => {
  const href = buildTelephoneHref(phone);
  if (!href) return false;
  window.location.href = href;
  return true;
};
