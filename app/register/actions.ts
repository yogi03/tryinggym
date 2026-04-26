"use server";
 
import { adminDb } from "@/lib/firebase/admin";
import { Member } from "@/types";
import { sendEmail, FROM_EMAIL } from "@/lib/mail";
import { generateMemberId } from "@/lib/member-id";
import { addExactMonths, formatDateOnly } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
 
async function sendMemberConfirmationEmail(
  memberEmail: string,
  memberName: string,
  gymName: string,
  details: Partial<Member>,
  endDate: string,
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[]
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  
  // Format payment split breakdown table
  const splitBreakdownHtml = paymentSplits && paymentSplits.length > 0 
    ? `
      <div style="margin-top: 20px; border-top: 1px solid #f3ece5; pt: 15px;">
        <h3 style="color: #B6916D; font-size: 16px; margin-bottom: 10px;">💰 Payment Split Breakdown</h3>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse; background: #fff; border-radius: 6px; overflow: hidden; border: 1px solid #f3ece5;">
          <thead style="background: #fcfaf8;">
            <tr>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #f3ece5; color: #888;">Recipient</th>
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #f3ece5; color: #888;">Mode</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #f3ece5; color: #888;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${paymentSplits.map(split => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #fcfaf8;">${split.receivedBy}</td>
                <td style="padding: 10px; border-bottom: 1px solid #fcfaf8; text-transform: uppercase;">${split.paymentMode || 'cash'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #fcfaf8; text-align: right; font-weight: 600;">₹${split.amount}</td>
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
    subject: `✅ Welcome to ${gymName} — Registration Confirmed!`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; color: #333;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #B6916D; font-size: 28px; margin-bottom: 10px;">Registration Confirmed! 🎉</h1>
          <p style="font-size: 16px; color: #666;">Hi <strong>${memberName}</strong>, your membership at <strong>${gymName}</strong> is now active.</p>
        </div>

        <div style="background-color: #fcfaf8; border: 1px solid #f3ece5; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
          <h3 style="color: #B6916D; border-bottom: 1px solid #f3ece5; padding-bottom: 10px; margin-top: 0;">📋 Your Registration Details</h3>
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #888; width: 40%;">Full Name:</td><td style="padding: 8px 0; font-weight: 600;">${details.fullName}</td></tr>
            ${details.nickname ? `<tr><td style="padding: 8px 0; color: #888;">Nickname:</td><td style="padding: 8px 0; font-weight: 600;">${details.nickname}</td></tr>` : ""}
            <tr><td style="padding: 8px 0; color: #888;">Phone:</td><td style="padding: 8px 0; font-weight: 600;">${details.phone}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Email:</td><td style="padding: 8px 0; font-weight: 600;">${details.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Gender:</td><td style="padding: 8px 0; font-weight: 600; text-transform: capitalize;">${details.gender}</td></tr>
            ${details.dob ? `<tr><td style="padding: 8px 0; color: #888;">Date of Birth:</td><td style="padding: 8px 0; font-weight: 600;">${new Date(details.dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</td></tr>` : ""}
            <tr><td style="padding: 8px 0; color: #888;">Plan Type:</td><td style="padding: 8px 0; font-weight: 600; text-transform: capitalize;">${details.membershipType}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Start Date:</td><td style="padding: 8px 0; font-weight: 600;">${new Date(details.membershipStartDate!).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">End Date:</td><td style="padding: 8px 0; font-weight: 600;">${new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</td></tr>
            <tr><td style="padding: 8px 0; color: #888;">Fees Paid:</td><td style="padding: 8px 0; font-weight: 600;">₹${details.feesPaid}</td></tr>
            ${details.address ? `<tr><td style="padding: 8px 0; color: #888;">Address:</td><td style="padding: 8px 0; font-weight: 600;">${details.address}</td></tr>` : ""}
            ${details.trainingType ? `<tr><td style="padding: 8px 0; color: #888;">Training Type:</td><td style="padding: 8px 0; font-weight: 600; text-transform: capitalize;">${details.trainingType}</td></tr>` : ""}
            ${details.healthAssessment ? `<tr><td style="padding: 8px 0; color: #888;">Health Assessment:</td><td style="padding: 8px 0; font-weight: 600;">${details.healthAssessment}</td></tr>` : ""}
            ${details.isTakingMedication ? `<tr><td style="padding: 8px 0; color: #888;">Taking Medication:</td><td style="padding: 8px 0; font-weight: 600; text-transform: capitalize;">${details.isTakingMedication}</td></tr>` : ""}
            ${details.fitnessGoals ? `<tr><td style="padding: 8px 0; color: #888;">Fitness Goals:</td><td style="padding: 8px 0; font-weight: 600;">${details.fitnessGoals}</td></tr>` : ""}
          </table>
          ${splitBreakdownHtml}
        </div>

        <div style="margin-bottom: 25px; padding: 15px; background-color: #f9f9f9; border-radius: 8px; font-size: 13px; line-height: 1.6;">
          <h3 style="margin-top: 0; color: #555; font-size: 16px;">📜 Declaration & Terms</h3>
          <ol style="padding-left: 20px; color: #666; margin-bottom: 10px;">
            <li>The gym management is not responsible for any loss or damage to personal belongings.</li>
            <li>I declare that I am not using any illegal performance-enhancing substances.</li>
            <li>I confirm that the health information provided is true.</li>
            <li>Vehicle parking is at the owner's risk.</li>
            <li>Fees once paid are <strong>non-refundable and non-transferable</strong>.</li>
          </ol>
          <p style="margin-top: 15px;">
            By registering, you have agreed to our full 
            <a href="${baseUrl}/terms-of-use?gym=${encodeURIComponent(gymName)}" style="color: #B6916D; text-decoration: none; font-weight: bold;">Terms of Service</a>.
          </p>
        </div>

        <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; pt: 20px;">
          <p>This is an automated confirmation of your registration.</p>
          <p style="margin-top: 8px; font-weight: bold; color: #B6916D;">— ${gymName} Team</p>
        </div>
      </div>
    `,
  });
}



function generateRegistrationWhatsAppText(
  memberName: string,
  gymName: string,
  details: Partial<Member>,
  endDate: string,
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[]
) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  
  let splitText = "";
  if (paymentSplits && paymentSplits.length > 0) {
    splitText = "\n*💰 Payment Split Breakdown:*\n" + 
      paymentSplits.map(s => `• ${s.receivedBy}: ₹${s.amount} (${s.paymentMode?.toUpperCase() || 'CASH'})`).join("\n") + "\n";
  }

  return `*Welcome to ${gymName}! 🎉*

Hello ${memberName}, your membership is now active! 

*📋 Registration Details:*
• Full Name: ${details.fullName}
${details.nickname ? `• Nickname: ${details.nickname}` : ''}
• Phone: ${details.phone}
• Email: ${details.email || 'N/A'}
• Gender: ${details.gender || 'N/A'}
${details.dob ? `• Date of Birth: ${new Date(details.dob).toLocaleDateString("en-IN")}` : ''}
• Plan Type: ${details.membershipType}
• Start Date: ${new Date(details.membershipStartDate!).toLocaleDateString("en-IN")}
• End Date: ${new Date(endDate).toLocaleDateString("en-IN")}
• Fees Paid: ₹${details.feesPaid}${splitText}
${details.address ? `• Address: ${details.address}` : ''}
${details.trainingType ? `• Training Type: ${details.trainingType}` : ''}
${details.healthAssessment ? `• Health Assessment: ${details.healthAssessment}` : ''}
${details.isTakingMedication ? `• Taking Medication: ${details.isTakingMedication}` : ''}
${details.fitnessGoals ? `• Fitness Goals: ${details.fitnessGoals}` : ''}

*📜 Declaration & Terms*
1. The gym management is not responsible for any loss or damage to personal belongings.
2. I declare that I am not using any illegal performance-enhancing substances.
3. I confirm that the health information provided is true.
4. Vehicle parking is at the owner's risk.
5. Fees once paid are *non-refundable and non-transferable*.

By registering, you have agreed to our full Terms of Service:
${baseUrl}/terms-of-use?gym=${encodeURIComponent(gymName)}

— ${gymName} Team`;
}

async function sendWhatsAppConfirmation(
  memberPhone: string,
  memberName: string,
  gymName: string,
  details: Partial<Member>,
  endDate: string,
  paymentSplits?: { amount: number; receivedBy: string; paymentMode?: string }[]
) {
  const textBody = generateRegistrationWhatsAppText(memberName, gymName, details, endDate, paymentSplits);
  await sendWhatsAppMessage(memberPhone, textBody);
}

export async function getRegistrationWhatsAppTextAction(memberId: string, gymId: string) {
  try {
    const memberDoc = await adminDb.collection("gyms").doc(gymId).collection("members").doc(memberId).get();
    if (!memberDoc.exists) throw new Error("Member not found");
    
    const member = memberDoc.data() as Member;
    const gymDoc = await adminDb.collection("gyms").doc(gymId).get();
    const gymName = gymDoc.exists ? (gymDoc.data()?.name || gymId) : gymId;

    // Find first non-trial plan
    const firstPlan = (member.planHistory || []).find(p => p.planType !== 'trial');
    
    // Override details if first plan is found in history
    const textDetails: Partial<Member> = firstPlan ? {
      ...member,
      membershipType: firstPlan.planType,
      membershipStartDate: firstPlan.startDate,
      feesPaid: firstPlan.amountPaid,
      trainingType: firstPlan.trainingType,
      personalTrainerId: firstPlan.personalTrainerId || undefined,
      offerType: firstPlan.offerType,
      offerRemark: firstPlan.offerRemark,
    } : member;

    const text = generateRegistrationWhatsAppText(
      member.fullName,
      gymName,
      textDetails,
      firstPlan?.endDate || member.membershipEndDate,
      (firstPlan?.paymentSplits || member.paymentSplits) as any
    );
    return { success: true, text, phone: member.phone };
  } catch (error) {
    console.error("Failed to get WhatsApp text:", error);
    return { success: false, error: (error as Error).message };
  }
}

export async function sendManualWhatsApp(memberId: string, gymId: string) {
  try {
    const memberDoc = await adminDb.collection("gyms").doc(gymId).collection("members").doc(memberId).get();
    if (!memberDoc.exists) throw new Error("Member not found");
    
    const member = memberDoc.data() as Member;
    const gymDoc = await adminDb.collection("gyms").doc(gymId).get();
    const gymName = gymDoc.exists ? (gymDoc.data()?.name || gymId) : gymId;

    await sendWhatsAppConfirmation(
      member.phone,
      member.fullName,
      gymName,
      member,
      member.membershipEndDate,
      member.paymentSplits as any
    );
    return { success: true };
  } catch (error) {
    console.error("Manual WhatsApp failed:", error);
    return { success: false, error: (error as Error).message };
  }
}

export { sendMemberConfirmationEmail, sendWhatsAppConfirmation };

export async function registerMember(gymId: string, values: Omit<Member, "memberId" | "gymId" | "membershipEndDate" | "createdAt">, photoUrl?: string) {
  if (!gymId) {
    return { success: false, error: "Invalid gym ID." };
  }

  try {
    const membersRef = adminDb.collection("gyms").doc(gymId).collection("members");
    const archiveRef = adminDb.collection("archives").doc(gymId).collection("members");

    // Check archive first to avoid duplicate self-registrations
    const archivedEmail = await archiveRef.where("email", "==", values.email).limit(1).get();
    if (!archivedEmail.empty) {
      return { success: false, error: "Already registered, contact admin", field: "email", code: "archived" };
    }
    const archivedPhone = await archiveRef.where("phone", "==", values.phone).limit(1).get();
    if (!archivedPhone.empty) {
      return { success: false, error: "Already registered, contact admin", field: "phone", code: "archived" };
    }

    // 1. Check if email/phone exists for this gym
    const emailQuery = await membersRef
      .where("email", "==", values.email)
      .get();
    
    if (!emailQuery.empty) {
      return { success: false, error: "Email already registered in this gym", field: "email" };
    }

    const phoneQuery = await membersRef
      .where("phone", "==", values.phone)
      .get();

    if (!phoneQuery.empty) {
      return { success: false, error: "Phone number already registered in this gym", field: "phone" };
    }

    // 2. Calculate end date
    const startDate = new Date(values.membershipStartDate);
    let durationMonths = 0;
    let durationDays = 0;

    if (values.membershipType === "monthly") durationMonths = 1;
    else if (values.membershipType === "quarterly") durationMonths = 3;
    else if (values.membershipType === "half-yearly") durationMonths = 6;
    else if (values.membershipType === "yearly") durationMonths = 12;
    else if (values.membershipType === "trial") durationDays = 1;
    else if (values.membershipType === "other" && (values as any).membershipTypeOther) {
      durationMonths = parseInt((values as any).membershipTypeOther) || 1;
    }

    const endDate = durationMonths > 0
      ? addExactMonths(values.membershipStartDate, durationMonths)
      : new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + durationDays);
    const endDateStr = formatDateOnly(endDate);

    // 3. Save to Firestore
    const memberId = generateMemberId(values.fullName, values.phone);

    const initialPlan = {
      planType: values.membershipType,
      startDate: values.membershipStartDate,
      endDate: endDateStr,
      amountPaid: (values as any).feesPaid || 0,
      trainingType: (values as any).trainingType || "general",
      personalTrainerId: (values as any).personalTrainerId || null,
      withGst: false,
      paymentSplits: (values as any).paymentSplits || [],
    };

    await membersRef.doc(memberId).set({
      ...values,
      gymId,
      membershipEndDate: endDateStr,
      createdAt: new Date().toISOString(),
      photoUrl: photoUrl || "",
      planHistory: [initialPlan],
    });

    // 4. Fetch gym name and send confirmation email & whatsapp
    try {
      const gymDoc = await adminDb.collection("gyms").doc(gymId).get();
      const gymName = gymDoc.exists ? (gymDoc.data()?.name || gymId) : gymId;
      
      const emailPromise = sendMemberConfirmationEmail(
        values.email,
        values.fullName,
        gymName,
        values as any,
        endDateStr,
        (values as any).paymentSplits
      ).catch(err => console.error("Background email failed:", err));

      const whatsappPromise = sendWhatsAppConfirmation(
        values.phone,
        values.fullName,
        gymName,
        values as any,
        endDateStr,
        (values as any).paymentSplits
      ).catch(err => console.error("Background whatsapp failed:", err));

      await Promise.all([emailPromise, whatsappPromise]);
    } catch (err) {
      console.error("Failed to process notifications:", err);
    }

    return { success: true };
  } catch (error) {
    console.error("Error in registerMember:", error);
    return { success: false, error: (error as Error).message || "Something went wrong. Please try again." };
  }
}
