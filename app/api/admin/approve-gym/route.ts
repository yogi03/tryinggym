import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { sendFinalApprovalEmailToOwner } from "@/lib/mails/onboarding";

function hashApprovalToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const gymId = searchParams.get("gymId");
  const token = searchParams.get("token");

  if (!gymId || !token) {
    return new NextResponse("Invalid request: Missing gymId or token.", { status: 400 });
  }

  try {
    const gymDoc = await adminDb.collection("gyms").doc(gymId).get();

    if (!gymDoc.exists) {
      return new NextResponse("Gym not found.", { status: 404 });
    }

    const gymData = gymDoc.data();

    const secretToken = process.env.ADMIN_APPROVAL_TOKEN;
    const storedTokenHash = gymData?.approvalTokenHash as string | undefined;
    const isLegacyTokenValid = Boolean(secretToken && token === secretToken);
    const isStoredTokenValid = Boolean(storedTokenHash && hashApprovalToken(token) === storedTokenHash);

    if (!isLegacyTokenValid && !isStoredTokenValid) {
      return new NextResponse("Unauthorized: Invalid approval token.", { status: 401 });
    }

    if (gymData?.onboardingStatus === "approved") {
      return new NextResponse(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
              <h1 style="color: #111827;">Already Approved</h1>
              <p style="color: #6b7280;">This gym has already been approved. Redirecting to login...</p>
              <script>
                setTimeout(() => {
                  window.location.href = '/admin/login';
                }, 3000);
              </script>
            </div>
          </body>
        </html>
      `, { headers: { "Content-Type": "text/html" } });
    }

    // Update gym status
    await adminDb.collection("gyms").doc(gymId).update({
      onboardingStatus: "approved"
    });

    // Notify owner
    if (gymData?.ownerEmail) {
      await sendFinalApprovalEmailToOwner(gymData.ownerEmail, gymData.name);
    }

    return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb;">
          <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
            <h1 style="color: #111827;">Gym Approved Successfully</h1>
            <p style="color: #6b7280;">The gym owner has been notified. Redirecting to login...</p>
            <script>
              setTimeout(() => {
                window.location.href = '/admin/login';
              }, 3000);
            </script>
          </div>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });

  } catch (error) {
    console.error("Approval API error:", error);
    return new NextResponse("Internal Server Error during approval.", { status: 500 });
  }
}
