import { NextResponse } from 'next/server';
import { sendEmail, FROM_EMAIL } from '@/lib/mail';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      gymId, trainerEmail, trainerName, trainerPhone, 
      memberName, earnings, startDate, endDate 
    } = body;

    if (!trainerEmail || !trainerName || !memberName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch Gym Info for Branding
    let gymName = "GymManagr";
    let contactEmail = "support@gymmanagr.com";
    
    if (gymId) {
      const gymSnap = await adminDb.collection("gyms").doc(gymId).get();
      if (gymSnap.exists) {
        const gymData = gymSnap.data();
        gymName = gymData?.name || gymName;
        contactEmail = gymData?.contactEmail || gymData?.ownerEmail || contactEmail;
      }
    }

    // 1. Send Email Notification
    const emailPromise = sendEmail({
      to: trainerEmail,
      fromName: gymName,
      fromEmail: FROM_EMAIL.ONBOARDING,
      subject: `New Member Assigned - ${memberName}`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0F0F1A; color: #ffffff; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #B6916D, #8B6D4F); padding: 30px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; color: #ffffff;">${gymName}</h1>
            <p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.85);">Trainer Notification</p>
          </div>
          
          <div style="padding: 30px;">
            <h2 style="color: #B6916D; margin-top: 0;">Hello ${trainerName},</h2>
            
            <p style="color: #cccccc; line-height: 1.6;">
              A new member has been assigned to you for personal training at <strong>${gymName}</strong>.
            </p>
            
            <div style="background: rgba(182, 145, 109, 0.1); border: 1px solid rgba(182, 145, 109, 0.2); border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #B6916D; margin-top: 0; margin-bottom: 12px;">Assignment Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #888888; font-size: 14px;">Member Name</td>
                  <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">${memberName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #888888; font-size: 14px;">Membership Period</td>
                  <td style="padding: 8px 0; color: #ffffff; font-size: 14px; text-align: right; font-weight: 600;">
                    ${startDate && endDate ? `${new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric'})} - ${new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric'})}` : 'N/A'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.05); color: #888888; font-size: 14px; padding-top: 12px; margin-top: 4px;">Your Monthly Earnings</td>
                  <td style="padding: 8px 0; border-top: 1px solid rgba(255,255,255,0.05); color: #4ade80; font-size: 14px; text-align: right; font-weight: 600; padding-top: 12px; margin-top: 4px;">₹${Number(earnings).toLocaleString()}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #999999; font-size: 13px; line-height: 1.5;">
              Please ensure you provide the best training experience for the new member. 
              Contact the gym administration if you have any questions.
            </p>
          </div>
          
          <div style="border-top: 1px solid rgba(255,255,255,0.1); padding: 20px 30px; text-align: center;">
            <p style="margin: 0; font-size: 12px; color: #666666;">
              <strong>${gymName}</strong><br/>
              Email: ${contactEmail}
            </p>
          </div>
        </div>
      `,
    });

    const whatsappPromise = (async () => {
      if (trainerPhone) {
        const whatsappText = `*New Member Assigned* 👤

Hello *${trainerName}*, a new member has been assigned for personal training.

• Member: ${memberName}
• Start Date: ${new Date(startDate).toLocaleDateString()}
• End Date: ${new Date(endDate).toLocaleDateString()}
• Expected Commission: ₹${Number(earnings).toLocaleString()}

Please ensure you provide the best training experience!
— ${gymName}`;

        await sendWhatsAppMessage(trainerPhone, whatsappText).catch(err => console.error("WhatsApp trainer notify failed:", err));
      }
    })();

    const [data] = await Promise.all([emailPromise, whatsappPromise]);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error sending trainer notification:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
