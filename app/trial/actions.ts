"use server";
 
import { adminDb } from "@/lib/firebase/admin";
import { sendEmail, FROM_EMAIL } from "@/lib/mail";
import { generateMemberId } from "@/lib/member-id";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
 
async function sendTrialConfirmationEmail(
  memberEmail: string,
  memberName: string,
  gymName: string,
  trialDate: string,
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[]
) {
  // Format payment split breakdown table
  const splitBreakdownHtml = paymentSplits && paymentSplits.length > 0 
    ? `
      <div style="margin-top: 20px; border-top: 1px solid #e5e7eb; pt: 15px;">
        <h3 style="color: #374151; font-size: 16px; margin: 0 0 12px 0;">💰 Payment Split Breakdown</h3>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb;">
          <thead style="background: #f9fafb;">
            <tr>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Recipient</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Mode</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${paymentSplits.map(split => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #f9fafb; color: #374151;">${split.receivedBy}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f9fafb; color: #374151; text-transform: uppercase;">${split.paymentMode || 'cash'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #f9fafb; text-align: right; font-weight: 600; color: #111827;">₹${split.amount}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : "";

  await sendEmail({
    to: memberEmail,
    fromName: gymName,
    fromEmail: FROM_EMAIL.ONBOARDING,
    subject: `✅ Trial Pass Confirmed — ${gymName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #111827; font-size: 24px; margin-bottom: 4px;">Welcome, ${memberName}! 🎉</h1>
          <p style="color: #6b7280; font-size: 16px;">Your trial pass at <strong>${gymName}</strong> has been confirmed.</p>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
          <h3 style="color: #374151; font-size: 16px; margin: 0 0 12px 0;">📋 Trial Details</h3>
          <table style="width: 100%; color: #6b7280; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Plan:</td>
              <td style="padding: 4px 0;">Trial (1 Day)</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: 600;">Trial Date:</td>
              <td style="padding: 4px 0;">${new Date(trialDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</td>
            </tr>
          </table>
          ${splitBreakdownHtml}
        </div>

        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 24px;">
          <p>If you enjoyed your trial, speak to the gym staff about continuing your membership!</p>
          <p style="margin-top: 8px;">— ${gymName} Team</p>
        </div>
      </div>
    `,
  });
}

function generateTrialWhatsAppText(
  memberName: string,
  gymName: string,
  trialDate: string,
  details: { email?: string; gender?: string; phone?: string; feesPaid?: number },
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[]
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  
  let splitText = "";
  if (paymentSplits && paymentSplits.length > 0) {
    splitText = "\n*💰 Payment Split Breakdown:*\n" + 
      paymentSplits.map(s => `• ${s.receivedBy}: ₹${s.amount} (${s.paymentMode?.toUpperCase() || 'CASH'})`).join("\n") + "\n";
  }

  return `*Trial Pass Confirmed! 🎉*

Hello ${memberName}, your trial pass at *${gymName}* is confirmed.

*📋 Trial Details:*
• Plan: Trial (1 Day)
• Trial Date: ${new Date(trialDate).toLocaleDateString("en-IN")}
• Phone: ${details.phone || 'N/A'}
• Email: ${details.email || 'N/A'}
• Gender: ${details.gender || 'N/A'}
• Fees Paid: ₹${details.feesPaid || 0}${splitText}

*📜 Declaration & Terms*
1. The gym management is not responsible for any loss or damage to personal belongings.
2. I declare that I am not using any illegal performance-enhancing substances.
3. I confirm that the health information provided is true.
4. Vehicle parking is at the owner's risk.

By registering, you have agreed to our full Terms of Service:
${baseUrl}/terms-of-use?gym=${encodeURIComponent(gymName)}

If you enjoy your trial, speak to the gym staff about continuing your membership!
— ${gymName} Team`;
}

export async function sendWhatsAppTrialConfirmation(
  memberPhone: string,
  memberName: string,
  gymName: string,
  trialDate: string,
  details: { email?: string; gender?: string; phone?: string; feesPaid?: number },
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[]
) {
  const textBody = generateTrialWhatsAppText(memberName, gymName, trialDate, details, paymentSplits);
  await sendWhatsAppMessage(memberPhone, textBody);
}

export async function getTrialWhatsAppTextAction(memberId: string, gymId: string) {
  try {
    const memberDoc = await adminDb.collection("gyms").doc(gymId).collection("members").doc(memberId).get();
    if (!memberDoc.exists) throw new Error("Member not found");
    
    const member = memberDoc.data() as any;
    const gymDoc = await adminDb.collection("gyms").doc(gymId).get();
    const gymName = gymDoc.exists ? (gymDoc.data()?.name || gymId) : gymId;

    const text = generateTrialWhatsAppText(
      member.fullName,
      gymName,
      member.membershipStartDate,
      {
        email: member.email,
        gender: member.gender,
        phone: member.phone,
        feesPaid: member.feesPaid
      },
      member.paymentSplits as any
    );
    return { success: true, text, phone: member.phone };
  } catch (error) {
    console.error("Failed to get Trial WhatsApp text:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function sendManualTrialWhatsApp(memberId: string, gymId: string) {
  try {
    const memberDoc = await adminDb.collection("gyms").doc(gymId).collection("members").doc(memberId).get();
    if (!memberDoc.exists) throw new Error("Member not found");
    
    const member = memberDoc.data() as any;
    const gymDoc = await adminDb.collection("gyms").doc(gymId).get();
    const gymName = gymDoc.exists ? (gymDoc.data()?.name || gymId) : gymId;

    await sendWhatsAppTrialConfirmation(
      member.phone,
      member.fullName,
      gymName,
      member.membershipStartDate,
      {
        email: member.email,
        gender: member.gender,
        phone: member.phone,
        feesPaid: member.feesPaid
      },
      member.paymentSplits as any
    );
    return { success: true };
  } catch (error) {
    console.error("Manual Trial WhatsApp failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

interface TrialFormValues {
  fullName: string;
  phone: string;
  email: string;
  gender: string;
  trialDate: string;
  feesPaid?: number;
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[];
}

export async function registerTrialMember(gymId: string, values: TrialFormValues) {
  if (!gymId) {
    return { success: false, error: "Invalid gym ID." };
  }

  try {
    const membersRef = adminDb.collection("gyms").doc(gymId).collection("members");

    // Check if email exists (only if email is provided)
    if (values.email) {
      const emailQuery = await membersRef.where("email", "==", values.email).get();
      if (!emailQuery.empty) {
        return { success: false, error: "Email already registered in this gym.", field: "email" };
      }
    }

    // Check if phone exists
    const phoneQuery = await membersRef.where("phone", "==", values.phone).get();
    if (!phoneQuery.empty) {
      return { success: false, error: "Phone number already registered in this gym.", field: "phone" };
    }

    // Calculate end date (trial = 1 day)
    const startDate = new Date(values.trialDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = endDate.toISOString().split("T")[0];

    // Generate member ID: first 2 letters of name + space + phone
    const memberId = generateMemberId(values.fullName, values.phone);

    const feesPaid = values.feesPaid || 0;

    const initialPlan = {
      planType: "trial",
      startDate: values.trialDate,
      endDate: endDateStr,
      amountPaid: feesPaid,
      paymentSplits: values.paymentSplits || [],
      trainingType: "general",
      personalTrainerId: null,
      withGst: false,
    };

    // Save to Firestore with minimal data
    await membersRef.doc(memberId).set({
      gymId,
      fullName: values.fullName,
      nickname: "",
      email: values.email,
      phone: values.phone,
      address: "",
      dob: "",
      gender: values.gender || "prefer-not-to-say",
      membershipType: "trial",
      membershipStartDate: values.trialDate,
      membershipEndDate: endDateStr,
      healthAssessment: "",
      isTakingMedication: "no",
      fitnessGoals: "",
      selfDeclaration: true,
      createdAt: new Date().toISOString(),
      feesPaid: feesPaid,
      isAcknowledged: false,
      photoUrl: "",
      planHistory: [initialPlan],
      paymentSplits: values.paymentSplits || [],
    });

    // Create payment records if splits are provided, otherwise fallback to feesPaid
    if (values.paymentSplits && values.paymentSplits.length > 0) {
      const sharedInvoiceId = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
      for (const split of values.paymentSplits) {
        if (Number(split.amount) > 0) {
          await adminDb.collection("gyms").doc(gymId).collection("payments").add({
            memberId,
            amount: Number(split.amount),
            date: new Date().toISOString(),
            type: "joining_fee",
            invoiceId: sharedInvoiceId,
            planType: "trial",
            startDate: values.trialDate,
            endDate: endDateStr,
            withGst: false,
            receivedBy: split.receivedBy,
            paymentMode: split.paymentMode || "cash"
          });
        }
      }
    } else if (feesPaid > 0) {
      const invoiceId = `INV-${Date.now().toString().slice(-8)}`;
      await adminDb.collection("gyms").doc(gymId).collection("payments").add({
        memberId,
        amount: feesPaid,
        date: new Date().toISOString(),
        type: "joining_fee",
        invoiceId,
        planType: "trial",
        startDate: values.trialDate,
        endDate: endDateStr,
        withGst: false,
      });
    }

    // Send confirmation email and whatsapp
    try {
      const gymDoc = await adminDb.collection("gyms").doc(gymId).get();
      const gymName = gymDoc.exists ? (gymDoc.data()?.name || gymId) : gymId;
      
      const promises: Promise<void>[] = [];

      if (values.email) {
        promises.push(
          sendTrialConfirmationEmail(
            values.email,
            values.fullName,
            gymName,
            values.trialDate,
            (values as any).paymentSplits
          ).catch(err => console.error("Background trial email failed:", err))
        );
      }

      promises.push(
        sendWhatsAppTrialConfirmation(
          values.phone,
          values.fullName,
          gymName,
          values.trialDate,
          {
            email: values.email,
            gender: values.gender,
            phone: values.phone,
            feesPaid: values.feesPaid
          },
          (values as any).paymentSplits
        ).catch(err => console.error("Background trial whatsapp failed:", err))
      );

      await Promise.all(promises);
    } catch (err) {
      console.error("Failed to process trial notifications:", err);
    }

    return { success: true };
  } catch (error) {
    console.error("Error in registerTrialMember:", error);
    return { success: false, error: (error as Error).message || "Something went wrong. Please try again." };
  }
}
