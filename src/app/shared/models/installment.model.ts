export interface InstallmentResponse {
  id: string;
  userId: string;
  description: string;
  accountId: string | null;
  purchaseMovementId?: string | null;
  interestRatePercent?: number;
  totalAmount: number;
  currency: string;
  trmApplied: number;
  installmentsCount: number;
  paidCount: number;
  startDate: string;
  isActive: boolean;
  monthlyAmount: number;
  remainingAmount: number;
  createdAt: string;
}

export interface InstallmentRequest {
  description: string;
  accountId?: string;
  totalAmount: number;
  currency: string;
  trmApplied?: number;
  installmentsCount: number;
  paidCount?: number;
  startDate: string;
}
