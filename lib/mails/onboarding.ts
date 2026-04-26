import { sendEmail, FROM_EMAIL } from "../mail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function sendPendingApprovalEmailToOwner(email: string, gymName: string) {
  await sendEmail({
    to: email,
    fromEmail: FROM_EMAIL.ONBOARDING,
    subject: `📩 Application Received — ${gymName} is under review`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 4px;">📩 Application Received</h1>
          <p style="color: #6b7280; font-size: 16px;">We've received your registration for <strong>${gymName}</strong>.</p>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.6;">
            Your application is currently being reviewed by our system administrators. This usually takes less than 24 hours.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
          Once approved, you will receive another email with instructions on how to access your dashboard.
        </p>

        <p style="color: #d1d5db; font-size: 11px; text-align: center; margin-top: 32px;">
          This email was sent to ${email} because you signed up for GymManagr platform.
        </p>
      </div>
    `,
  });
}

export async function sendApprovalRequestToAdmin(
  gymId: string,
  gymName: string,
  ownerEmail: string,
  ownerPhone: string,
  approvalToken: string
) {
  const adminEmail = process.env.SYSTEM_ADMIN_EMAIL || process.env.EMAIL_USER || "unfav.tushar@gmail.com";
  const approvalLink = `${APP_URL}/api/admin/approve-gym?gymId=${encodeURIComponent(gymId)}&token=${encodeURIComponent(approvalToken)}`;

  await sendEmail({
    to: adminEmail,
    fromEmail: FROM_EMAIL.ONBOARDING,
    subject: `🚨 Action Required: New Gym Registration — ${gymName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h1 style="color: #111827; font-size: 20px; margin-bottom: 16px;">New Gym Pending Approval</h1>
        
        <table style="width: 100%; margin-bottom: 24px; font-size: 14px; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; width: 120px;">Gym Name:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 500;">${gymName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Owner Email:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 500;">${ownerEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Owner Mobile:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 500;">${ownerPhone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280;">Gym ID:</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 500;">${gymId}</td>
          </tr>
        </table>

        <div style="text-align: center; margin-top: 32px;">
          <a href="${approvalLink}"
            style="background: #10B981; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
            Approve Gym Registration →
          </a>
        </div>

        <p style="color: #ef4444; font-size: 12px; margin-top: 24px;">
           Warning: Please verify the gym details before approving.
        </p>
      </div>
    `,
  });
}

export async function sendFinalApprovalEmailToOwner(email: string, gymName: string) {
  await sendEmail({
    to: email,
    fromEmail: FROM_EMAIL.ONBOARDING,
    subject: `🎉 Approved! — ${gymName} is now live on GymManagr`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 4px;">🎉 You're Approved!</h1>
          <p style="color: #6b7280; font-size: 16px;">Your gym, <strong>${gymName}</strong>, has been approved and is now live.</p>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <p style="color: #374151; margin: 0; font-size: 14px; line-height: 1.6;">
            You can now log in to your admin dashboard and start managing your gym.
          </p>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <a href="${APP_URL}/admin/login"
            style="background: #111827; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; display: inline-block;">
            Go to Admin Login →
          </a>
        </div>

        <p style="color: #d1d5db; font-size: 11px; text-align: center; margin-top: 32px;">
          This email was sent to ${email} because your registration was approved.
        </p>
      </div>
    `,
  });
}
