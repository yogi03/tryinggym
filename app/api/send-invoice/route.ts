import { NextResponse } from 'next/server';
import { sendEmail, FROM_EMAIL } from '@/lib/mail';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      gymId, email, memberName, invoiceId, pdfBase64,
      phone, amount, planType, withGst 
    } = body;

    if (!email || !pdfBase64) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch Gym Info for Branding
    let gymName = "Vyom";
    let contactEmail = "billing@vyomgymandclub.com";
    
    if (gymId) {
      const gymSnap = await adminDb.collection("gyms").doc(gymId).get();
      if (gymSnap.exists) {
        const gymData = gymSnap.data();
        gymName = gymData?.name || gymName;
        contactEmail = gymData?.contactEmail || gymData?.ownerEmail || contactEmail;
      }
    }

    // 1. Send Email (with PDF)
    const { data } = await sendEmail({
      to: email,
      fromName: gymName,
      fromEmail: FROM_EMAIL.BILLING,
      subject: `Invoice ${invoiceId || ''} from ${gymName}`,
      html: `
        <h2>Hello ${memberName || 'Member'},</h2>
        <p>Please find attached your latest invoice from <strong>${gymName}</strong>.</p>
        <p>If you have any questions, feel free to contact us.</p>
        <br/>
        <p>Best regards,</p>
        <p>Team ${gymName}</p>
        <br/>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888;">
          <strong>${gymName}</strong><br/>
          Email: ${contactEmail}
        </p>
      `,
      attachments: [
        {
          filename: `Invoice_${invoiceId || gymName.replace(/\s+/g, '_')}.pdf`,
          content: pdfBase64,
          encoding: 'base64',
        },
      ],
    });

    if (phone) {
      const whatsappText = `*Invoice Generated* 🧾

Hello ${memberName || 'Member'}, your invoice for ${gymName} has been generated.

• Invoice No: ${invoiceId || 'N/A'}
• Amount: ₹${amount || 0}
• Plan: ${planType || 'Membership'}
• Type: ${withGst ? 'Tax Invoice' : 'Invoice'}

We have sent you the invoice pdf on your mail, you can dowwnload it from there.

Thank you,
— ${gymName}`;

      await sendWhatsAppMessage(phone, whatsappText).catch(err => console.error("WhatsApp invoice failed:", err));
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error sending invoice email/wa:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}

