"use server";

import { sendEmail } from "@/lib/mail";

export async function notifyDeveloperOfGST(gymName: string, gstNo: string, documentUrl: string, pdfBase64?: string) {
  try {
    // We send an email to the developer with a link and clear instructions
    const developerEmail = "yogendrachaurasiya30@gmail.com";
    
    // Use fl_attachment to force download/correct headers in the link
    const downloadUrl = documentUrl.includes('?') ? `${documentUrl}&fl_attachment` : `${documentUrl}?fl_attachment`;

    let base64Content = pdfBase64;

    // If no direct base64, try to fetch (fallback)
    if (!base64Content) {
      try {
        const fileRes = await fetch(documentUrl);
        if (fileRes.ok) {
          const buffer = await fileRes.arrayBuffer();
          base64Content = Buffer.from(buffer).toString('base64');
        }
      } catch (err) {
        console.error("[GST Notification] Fallback fetch failed:", err);
      }
    }
    
    const attachment = base64Content ? {
      filename: `GST_Document_${gymName.replace(/\s+/g, '_')}.pdf`,
      content: base64Content,
      encoding: 'base64',
    } : null;

    await sendEmail({
      to: developerEmail,
      subject: `New GST Verification Request: ${gymName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-lg: 12px;">
          <h2 style="color: #B6916D; border-bottom: 2px solid #B6916D; padding-bottom: 10px;">GST Verification Request</h2>
          <p>A gym owner has submitted a GST number for verification.</p>
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Gym Name:</strong> ${gymName}</p>
            <p style="margin: 5px 0;"><strong>GST Number:</strong> ${gstNo}</p>
            <p style="margin: 15px 0 5px 0;"><strong>Document Link:</strong></p>
            <a href="${downloadUrl}" style="word-break: break-all; color: #B6916D; font-size: 13px;">${documentUrl}</a>
          </div>
          <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
            Please log in as a developer to approve or reject this request. 
            The document is also attached to this email for your convenience.
          </p>
        </div>
      `,
      attachments: attachment ? [attachment] : []
    });

    return { success: true };
  } catch (error) {
    console.error("Notify developer error:", error);
    return { success: false, error: (error as Error).message };
  }
}
