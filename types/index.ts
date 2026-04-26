export interface Gym {
  gymId: string;
  name: string;
  address: string;
  ownerEmail: string;
  contactEmail?: string; // Specific email for invoices/contact
  logoUrl?: string; // Gym-specific logo from Cloudinary
  subscriptionStatus: "active" | "expired" | "trial";
  subscriptionStart: string; // ISO Date
  subscriptionEnd: string; // ISO Date
  createdAt: string; // ISO Date
  phone?: string;
  gstNo?: string;
  gstStatus?: 'pending' | 'validated' | 'rejected' | 'none';
  gstDocumentUrl?: string;
  ptGymFee?: number; // Base gym fee deducted for personal training profit share
  onboardingStatus?: 'pending' | 'approved' | 'rejected';
  paymentRecipients?: string[]; // List of admins/staff who can receive payments
  archivedPaymentRecipients?: string[]; // List of archived payment recipients
}

export interface Admin {
  adminId: string;
  email: string;
  gymId: string;
  role: "admin" | "developer";
}

export interface TrainerAccount {
  trainerAccountId: string;
  email: string;
  gymId: string;
  staffId: string;
  role: "trainer";
  createdAt?: string;
  uid?: string;
}

export interface FrontDeskAccount {
  frontDeskAccountId: string;
  email: string;
  gymId: string;
  staffId: string;
  role: "front_desk";
  createdAt?: string;
  uid?: string;
}

export interface Installment {
  id: string;            // unique identifier (e.g. timestamp or uuid)
  amount: number;        // installment amount
  dueDate: string;       // ISO date string (YYYY-MM-DD or full ISO)
  status: "pending" | "paid" | "archived";
  paidDate?: string;     // ISO date when paid
  invoiceId?: string;    // ID of the invoice generated upon payment
}

export interface Member {
  memberId: string;
  gymId: string;
  fullName: string;
  nickname?: string;
  email: string;
  phone: string;
  address: string;
  dob: string; // ISO Date
  gender: "male" | "female" | "other" | "prefer-not-to-say";
  membershipType: string;
  membershipStartDate: string; // ISO Date
  membershipEndDate: string; // ISO Date
  paymentOption: string;
  healthAssessment: string;
  isTakingMedication: string;
  fitnessGoals?: string;
  selfDeclaration: boolean;
  createdAt: string; // ISO Date
  feesPaid?: number; // Amount paid by member
  filteredFeesPaid?: number; // Computed fees during a filtered period
  isAcknowledged?: boolean; // Whether the member has been marked as 'Done' on the dashboard
  photoUrl?: string; // Firebase Storage URL for member photo
  isArchived?: boolean; // Whether the member is in archive
  archivedAt?: string; // ISO Date of archival
  planHistory?: {
    planType: string;
    startDate: string;
    endDate: string;
    amountPaid: number;
    trainingType?: "general" | "personal";
    personalTrainerId?: string | null;
    withGst?: boolean;
    offerType?: string;
    offerRemark?: string;
    paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[];
    ptGymFee?: number;
    basePrice?: number;
    discountType?: "amount" | "percentage";
    discountValue?: string;
    installments?: Installment[];
  }[];
  withGst?: boolean;
  personalTrainerId?: string; // Staff ID of assigned personal trainer
  notes?: string; // Admin notes
  notesHistory?: { date: string; note: string }[];
  trainingType?: "general" | "personal";
  bloodGroup?: string;
  profession?: string;
  offerType?: string;
  offerRemark?: string;
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[];
  ptGymFee?: number;
  basePrice?: number;
  discountType?: "amount" | "percentage";
  discountValue?: string;
  installments?: Installment[];
  familyMemberIds?: string[];
}

export interface ArchivedMember extends Member {
  archivedAt: string;       // ISO timestamp of when deletion happened
  archivedBy: string;       // UID of the admin who deleted
  originalGymId: string;    // gym ID the member belonged to
  archiveType: "member";    // discriminator
}

export interface ArchivedGym extends Gym {
  archivedAt: string;
  archivedBy: string;
  members: Member[];        // all members snapshot at time of gym deletion
  archiveType: "gym";
}

export interface ArchivedStaff extends Staff {
  archivedAt: string;       // ISO timestamp of when deletion happened
  archivedBy: string;       // UID of the admin who deleted
  originalGymId: string;    // gym ID the staff belonged to
  archiveType: "staff";     // discriminator
}

export interface User {
  userId: string;
  email: string;
  name: string;
  photoURL?: string;
  createdAt: string; // ISO Date
}

export interface Staff {
  staffId: string;
  gymId: string;
  fullName: string;
  email: string;
  phone: string;
  role: "Trainer" | "Front Desk" | "Manager" | "Other";
  certifications?: string[];
  specialties?: string[];
  availability: {
    days: string[]; // e.g. ["M", "W", "F"] or ["M-F"]
    shifts: string[]; // e.g. ["AM", "PM"]
  };
  status: "Active" | "Inactive" | "Available";
  photoUrl?: string; // Firebase Storage URL for staff photo
  createdAt: string; // ISO Date
  assignedMembersCount?: number;
  salary?: number; // Monthly salary
  weekSchedule?: {
    day: string; // e.g. "Mon", "Tue"
    startTime: string; // e.g. "09:00"
    endTime: string; // e.g. "17:00"
  }[];
  joiningDate?: string; // ISO Date
  notes?: string; 
  notesHistory?: { date: string; note: string }[];
  trainerAuthUid?: string;
  trainerLoginEmail?: string;
  trainerLoginEnabled?: boolean;
  staffAuthUid?: string;
  staffLoginEmail?: string;
  staffLoginEnabled?: boolean;
}

export interface Payment {
  id?: string;
  memberId: string;
  amount: number;
  date: string; // ISO String
  type: "joining_fee" | "renewal_fee" | "fee_correction" | "other" | string;
  durationMonths?: number | null;
  invoiceId?: string;
  planType?: string;
  startDate?: string;
  endDate?: string;
  withGst?: boolean;
  gstToggleCount?: number;
  receivedBy?: string; // Name of the admin/recipient who received this payment
}

export interface Inquiry {
  id: string;
  gymId: string;
  fullName: string;
  phone: string;
  email?: string;
  nickname?: string;
  address?: string;
  dob?: string;
  gender?: "male" | "female" | "other" | "prefer-not-to-say";
  membershipType?: string;
  membershipStartDate?: string;
  membershipEndDate?: string;
  feesPaid?: number;
  paymentOption?: string;
  isTakingMedication?: string;
  healthAssessment?: string;
  fitnessGoals?: string;
  photoUrl?: string;
  notes: string; // Conclusive point after talk (Required)
  notesHistory?: { date: string; note: string }[];
  createdAt: string;
  reminderDate?: string; // ISO Date to contact back
  status: "pending" | "converted";
  conversionDate?: string; // ISO Date if status is "converted"
  trainingType?: "general" | "personal";
  personalTrainerId?: string; // ID of the trainer if trainingType is "personal"
}
