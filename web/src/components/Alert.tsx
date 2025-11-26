import type { ReactNode } from 'react';

type AlertProps = {
  kind?: 'info' | 'error' | 'success';
  children: ReactNode;
};

export function Alert({ kind = 'info', children }: AlertProps) {
  const role = kind === 'error' ? 'alert' : 'status';
  return (
    <p className={`alert alert--${kind}`} role={role}>
      {children}
    </p>
  );
}
