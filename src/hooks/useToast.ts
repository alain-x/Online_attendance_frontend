import { useState, useCallback } from 'react';

export function useToast() {
  type ToastType = 'success' | 'error' | 'warning' | 'info';
  type ToastState = { message: string; type: ToastType };

  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}
