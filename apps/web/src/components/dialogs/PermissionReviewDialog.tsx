// No-op mock — PermissionReviewDialog is never shown in the demo
import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  manifest: unknown;
  verified?: boolean;
  onApprove: () => void;
  installing?: boolean;
}

export default function PermissionReviewDialog({ isOpen }: Props) {
  if (!isOpen) return null;
  return null;
}
