import { NextResponse } from 'next/server';
import { sendEmail, FROM_EMAIL } from '@/lib/mail';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(req: Request) {
  try {
    const { gymId, name, contact, email, subject, city, message } = await req.json();

    if (!name || !contact || !email || !subject || !city) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Default branding (Platform level)
    let brandName = "Vyom";
    let recipientEmail = "info@vyomgymandclub.com"; 

    if (gymId) {
      const gymSnap = await adminDb.collection("gyms").doc(gymId).get();
      if (gymSnap.exists) {
        const gymData = gymSnap.data();
        brandName = gymData?.name || brandName;
        recipientEmail = gymData?.contactEmail || gymData?.ownerEmail || recipientEmail;
      }
    }

    const data = await sendEmail({
      to: recipientEmail,
      fromName: "Vyom Enquiries",
      fromEmail: FROM_EMAIL.INFO,
      subject: `[${brandName}] ${subject} from ${name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; padding: 20px;">
          <h2 style="color: #B6916D; border-bottom: 2px solid #F4F4F5; padding-bottom: 10px;">New Inquiry for ${brandName}</h2>
          <div style="margin-top: 20px; line-height: 1.6; color: #333;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Contact:</strong> ${contact}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>City:</strong> ${city}</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <div style="margin-top: 20px; padding: 15px; background: #F9FAFB; border-radius: 8px;">
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap;">${message}</p>
            </div>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #EEE; padding-top: 20px;">
            This enquiry was sent via the ${brandName} website.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Contact API error:", error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
