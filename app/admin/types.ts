// File: app/admin/types.ts

export type AdminVisitor = {
  id: string;
  createdAt: string | null;
  fullName: string;
  phoneNumber: string | null;
  institution: string | null;
  internetNumber: string | null;
  address: string | null;
  category: string | null;
  purpose: string;
  hostName: string | null;
  photoUrl: string | null;
  status: "PENDING" | "ON_PROGRESS" | "SUCCESS" | "CANCELLED" | "PRE_REGISTER";
  checkInTime: string | null;
  serviceStartTime: string | null;
  checkOutTime: string | null;
  rating: number | null;
  pin?: string | null;
};

export type AdminDashboardData = {
  connectionOk: boolean;
  visitors: AdminVisitor[];
  metrics: {
    totalToday: number;
    totalMonth: number;
    totalYear: number;
    pendingVisits: number;
    onProgressVisits: number;
    successVisits: number;
    completedToday: number;
    averageRating: number | null;
  };
  categories: Array<{
    name: string;
    count: number;
  }>;
  dailySeries: Array<{ label: string; value: number }>;
  monthlySeries: Array<{ label: string; value: number }>;
  yearlySeries: Array<{ label: string; value: number }>;
  categoryDailySeries: Array<{
    name: string;
    data: Array<{ label: string; value: number }>;
  }>;
  categoryMonthlySeries: Array<{
    name: string;
    data: Array<{ label: string; value: number }>;
  }>;
  categoryYearlySeries: Array<{
    name: string;
    data: Array<{ label: string; value: number }>;
  }>;
  peakHoursSeries: Array<{ label: string; value: number }>;
  completionRatio: {
    success: number;
    cancelled: number;
  };
  kioskStatus?: {
    isBusy: boolean;
    message: string;
  };
};