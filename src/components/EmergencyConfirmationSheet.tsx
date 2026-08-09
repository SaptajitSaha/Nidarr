import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Phone, Volume2, X } from 'lucide-react';
import type { EmergencyConfirmation } from '../types/emergency';

interface EmergencyConfirmationSheetProps {
  confirmation: Exclude<EmergencyConfirmation, null>;
  maskedTrustedContactNumber: string;
  onCancel: () => void;
  onConfirm112: () => void;
  onConfirmTrustedContact: () => void;
  onConfirmSiren: () => void;
}

const confirmationCopy = (confirmation: Exclude<EmergencyConfirmation, null>, maskedNumber: string) => {
  switch (confirmation) {
    case 'call-112':
      return {
        title: 'Open emergency dialer?',
        body: 'Nidarr will open your phone or device dialer with 112. Nidarr will not place the call automatically; you must confirm the call in the dialer.',
        action: 'Open dialer with 112',
        icon: <Phone size={23} />,
      };
    case 'call-trusted-contact':
      return {
        title: 'Open trusted-contact dialer?',
        body: `Nidarr will open your device dialer for ${maskedNumber}. Nidarr will not place the call automatically; you must confirm it in the dialer.`,
        action: 'Open trusted-contact dialer',
        icon: <Phone size={23} />,
      };
    case 'siren':
      return {
        title: 'Start emergency siren?',
        body: 'The siren sound may be loud. Nidarr starts it at a conservative level, but your device and browser volume still control the sound. You can stop it at any time.',
        action: 'Start emergency siren',
        icon: <Volume2 size={23} />,
      };
  }
};

export const EmergencyConfirmationSheet: React.FC<EmergencyConfirmationSheetProps> = ({
  confirmation,
  maskedTrustedContactNumber,
  onCancel,
  onConfirm112,
  onConfirmTrustedContact,
  onConfirmSiren,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const copy = confirmationCopy(confirmation, maskedTrustedContactNumber);

  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, []);

  const handleConfirm = confirmation === 'call-112'
    ? onConfirm112
    : confirmation === 'call-trusted-contact'
      ? onConfirmTrustedContact
      : onConfirmSiren;

  return (
    <div
      className="emergency-confirmation-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-confirmation-title"
      aria-describedby="emergency-confirmation-copy"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="emergency-confirmation-sheet animate-slide-up">
        <div className="emergency-confirmation-header">
          <div className="emergency-confirmation-icon">{copy.icon}</div>
          <button ref={cancelButtonRef} type="button" className="sheet-close-btn" onClick={onCancel} aria-label="Close confirmation">
            <X size={20} />
          </button>
        </div>
        <h2 id="emergency-confirmation-title">{copy.title}</h2>
        <p id="emergency-confirmation-copy">{copy.body}</p>
        {confirmation !== 'siren' && (
          <p className="emergency-confirmation-disclosure"><AlertTriangle size={15} />No call is placed until you confirm it in the device dialer.</p>
        )}
        <div className="emergency-confirmation-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-emergency" onClick={handleConfirm}>{copy.action}</button>
        </div>
      </section>
    </div>
  );
};
