export type FkWebCommandType = "CREATE_USER" | "UPDATE_USER_VALIDITY" | "DELETE_USER";

export interface DeviceCommand {
  type: FkWebCommandType;
  pin: string;
  name?: string;
  validFrom?: string;
  validTo?: string;
  status: "pending" | "sent" | "failed";
  createdAt: any; // Firestore Timestamp
  sentAt?: any;   // Firestore Timestamp
}

export interface AttendanceLog {
  devicePin: string;
  memberId: string;
  memberName: string;
  timestamp: any; // Firestore Timestamp
  verifyMode: string;
  rawEntry: string;
}

export interface BiometricDevice {
  cloudId: string;
  label: string;
  lastSeen: any; // Firestore Timestamp
}
