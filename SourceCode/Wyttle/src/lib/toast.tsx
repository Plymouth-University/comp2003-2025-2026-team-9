import { Toast, ToastVariant } from '@/components/ui/Toast';
import React, { ReactNode, useCallback, useState } from 'react';

let _show: ((message: string, variant?: ToastVariant, duration?: number) => void) | null = null;

export function showToast(message: string, variant: ToastVariant = 'error', duration = 4000) {
  if (_show) _show(message, variant, duration);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState<ToastVariant>('error');
  const [duration, setDuration] = useState(4000);

  const handleShow = useCallback((msg: string, v: ToastVariant = 'error', d = 4000) => {
    setMessage(msg);
    setVariant(v);
    setDuration(d);
    setVisible(true);
  }, []);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    setMessage('');
  }, []);

  // Register global hook
  _show = handleShow;

  return (
    <>
      {children}
      <Toast visible={visible} message={message} variant={variant} duration={duration} onDismiss={handleDismiss} />
    </>
  );
}

export default ToastProvider;
