export type ToastKind = 'info' | 'good' | 'bad';
export function toast(message: string, kind: ToastKind = 'info') {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nbf-toast', { detail: { message, kind } }));
}
