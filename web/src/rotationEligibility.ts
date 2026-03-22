export function isRotationPreviewEligibleStatus(status: string | null | undefined): boolean {
  return status === 'sending' || status === 'paused' || status === 'complete';
}
