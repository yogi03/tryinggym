"use server";

import { sendPendingApprovalEmailToOwner, sendApprovalRequestToAdmin } from "@/lib/mails/onboarding";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import crypto from "crypto";
 
function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}
 
function generateRandomSuffix(length: number = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
 
function generateGymId(gymName: string): string {
  return `${slugify(gymName)}-${generateRandomSuffix(6)}`;
}

function generateApprovalToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashApprovalToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
 
// Password strength validator
function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters long.";
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must contain at least one special character (e.g. !@#$%).";
  return null;
}
 

export async function registerGymAndOwner(formData: FormData) {
  const gymName = formData.get("gymName") as string;
  const gymAddress = formData.get("gymAddress") as string;
  const ownerEmail = formData.get("ownerEmail") as string;
  const password = formData.get("password") as string;
  const gymPhone = formData.get("gymPhone") as string;
  const gstNo = formData.get("gstNo") as string;

  if (!gymName || !gymAddress || !ownerEmail || !password || !gymPhone) {
    return { success: false, error: "All required fields must be filled" };
  }

  // Validate password strength
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { success: false, error: passwordError };
  }

  // Generate unique gym ID: slugified name + 6 random alphanumeric chars
  const gymId = generateGymId(gymName);

  try {
    // 2. Check if Admin email already exists in Firestore or Auth
    try {
      await adminAuth.getUserByEmail(ownerEmail);
      return { success: false, error: "An account with this email already exists in Firebase Auth." };
    } catch (e) {
      if ((e as { code?: string }).code !== "auth/user-not-found") {
        throw e;
      }
    }

    const adminQuery = await adminDb.collection("admins").where("email", "==", ownerEmail).get();
    if (!adminQuery.empty) {
      return { success: false, error: "Admin email is already registered in our database." };
    }

    // 3. Create User in Firebase Auth
    const user = await adminAuth.createUser({
      email: ownerEmail,
      password: password,
      displayName: gymName + " Admin",
    });

    // 4. Create Gym document
    const now = new Date().toISOString();
    const subscriptionEnd = new Date();
    subscriptionEnd.setFullYear(subscriptionEnd.getFullYear() + 1);
    const approvalToken = generateApprovalToken();

    await adminDb.collection("gyms").doc(gymId).set({
      name: gymName,
      address: gymAddress,
      ownerEmail: ownerEmail,
      phone: gymPhone,
      gstNo: gstNo || "",
      subscriptionStatus: "active",
      subscriptionStart: now,
      subscriptionEnd: subscriptionEnd.toISOString(),
      onboardingStatus: "pending",
      approvalTokenHash: hashApprovalToken(approvalToken),
      approvalTokenIssuedAt: now,
      createdAt: now,
    });

    // 5. Create Admin document
    await adminDb.collection("admins").doc(user.uid).set({
      email: ownerEmail,
      gymId: gymId,
      role: "admin",
      createdAt: now,
      uid: user.uid,
    });

    // 6. Send emails (non-blocking)
    try {
      await Promise.all([
        sendPendingApprovalEmailToOwner(ownerEmail, gymName),
        sendApprovalRequestToAdmin(gymId, gymName, ownerEmail, gymPhone, approvalToken)
      ]);
    } catch (emailErr) {
      console.warn("Onboarding emails failed (registration still succeeded):", emailErr);
    }

    return { success: true };
  } catch (error) {
    console.error("Error in registerGymAndOwner:", error);
    return { success: false, error: (error as Error).message || "Failed to register gym and owner." };
  }
}
