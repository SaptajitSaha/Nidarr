export const maskPhoneNumber = (phone?: string) => {
  if (!phone) return 'Not provided';
  const digits = phone.replace(/\D/g, '');
  return digits.length > 0 ? `******${digits.slice(-4)}` : 'Not provided';
};

export const normalizeDialablePhoneNumber = (phone: string) => {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  return `${trimmed.startsWith('+') ? '+' : ''}${digits}`;
};
