"use server";

import { sendEmail } from "@/lib/mail";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
 
// Generates a 4-digit numeric OTP
function generateOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
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
 
// ─── Send OTP ─────────────────────────────────────────────────────────────────
export async function sendOTP(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Check the email belongs to a registered front desk account
    const fdRef = adminDb.collection("frontDeskAccounts");
    const snapshot = await fdRef.where("email", "==", email).get();
 
    if (snapshot.empty) {
      return { success: false, error: "No front desk account found with this email address." };
    }
 
    // 2. Generate OTP + expiry (60 seconds from now)
    const otp = generateOTP();
    const expiresAt = Date.now() + 60 * 1000;
 
    // 3. Store OTP in Firestore
    const fdDoc = snapshot.docs[0];
    await fdDoc.ref.update({ otp, otpExpiresAt: expiresAt });
 
    await sendEmail({
      to: email,
      subject: "Your Front Desk Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #1f2937; margin-bottom: 8px;">Front Desk Password Reset</h2>
          <p style="color: #6b7280; margin-bottom: 24px;">Use the code below to reset your front desk password. This code is valid for <strong>60 seconds</strong>.</p>
          <div style="background: #f3f4f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #111827;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return { success: true };
  } catch (err) {
    console.error("sendOTP error:", err);
    return { success: false, error: "Failed to send OTP. Please try again." };
  }
}

// ─── Verify OTP ───────────────────────────────────────────────────────────────
export async function verifyOTP(
  email: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fdRef = adminDb.collection("frontDeskAccounts");
    const snapshot = await fdRef.where("email", "==", email).get();

    if (snapshot.empty) {
      return { success: false, error: "Front desk account not found." };
    }

    const fdDoc = snapshot.docs[0];
    const data = fdDoc.data();

    if (!data.otp || !data.otpExpiresAt) {
      return { success: false, error: "No OTP found. Please request a new one." };
    }

    if (Date.now() > data.otpExpiresAt) {
      return { success: false, error: "OTP has expired. Please request a new one." };
    }

    if (data.otp !== otp) {
      return { success: false, error: "Incorrect OTP. Please try again." };
    }

    // OTP is valid — clear it
    await fdDoc.ref.update({ otp: null, otpExpiresAt: null });

    return { success: true };
  } catch (err) {
    console.error("verifyOTP error:", err);
    return { success: false, error: "Verification failed. Please try again." };
  }
}

// ─── Reset Password ──────────────────────────────────────────────────────────
export async function resetPassword(
  email: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return { success: false, error: passwordError };
    }

    const user = await adminAuth.getUserByEmail(email);
    await adminAuth.updateUser(user.uid, { password: newPassword });

    return { success: true };
  } catch (err) {
    console.error("resetPassword error:", err);
    return { success: false, error: "Failed to reset password. Please try again." };
  }
}
