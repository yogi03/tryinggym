import { Resend } from 'resend';
import nodemailer from 'nodemailer';

// Resend client for domain-based emails
const resend = new Resend(process.env.RESEND_API_KEY);

// Gmail transporter for OTP and system emails
const gmailUser = process.env.EMAIL_USER;
const gmailPass = process.env.EMAIL_PASS;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailPass,
  },
});

// Domain-specific "from" email addresses
export const FROM_EMAIL = {
  ONBOARDING: process.env.RESEND_FROM_EMAIL_ONBOARDING || 'onboarding@vyomgymandclub.com',
  BILLING: process.env.RESEND_FROM_EMAIL_INVOICE || 'billing@vyomgymandclub.com',
  INFO: process.env.RESEND_FROM_EMAIL_INQUIRE || 'info@vyomgymandclub.com',
} as const;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  fromEmail?: string;
  attachments?: any[];
}

/**
 * Sends an email using the appropriate provider:
 * - If `fromEmail` is provided (domain-based), uses Resend
 * - Otherwise, falls back to Gmail/nodemailer (for OTP, system emails)
 */
export async function sendEmail({ to, subject, html, fromName, fromEmail, attachments }: SendEmailOptions) {
  const senderName = fromName || "GymManagr";

  // Use Resend for domain-based emails
  if (fromEmail) {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not found in environment variables');
      throw new Error('Resend API key missing');
    }

    const resendPayload: any = {
      from: `${senderName} <${fromEmail}>`,
      to,
      subject,
      html,
    };

    if (attachments && attachments.length > 0) {
      resendPayload.attachments = attachments.map((att: any) => ({
        filename: att.filename,
        content: att.content ? Buffer.from(att.content, att.encoding || 'base64') : att.content,
      }));
    }

    try {
      const { data, error } = await resend.emails.send(resendPayload);
      if (error) {
        console.error('Resend email error:', error);
        throw new Error(error.message);
      }
      return { success: true, data };
    } catch (error) {
      console.error('Error sending email via Resend:', error);
      throw error;
    }
  }

  // Fallback to Gmail/nodemailer for OTP and system emails
  if (!gmailUser || !gmailPass) {
    console.error('Email credentials not found in environment variables');
    throw new Error('Email configuration missing');
  }

  const mailOptions = {
    from: `"${senderName}" <${gmailUser}>`,
    to,
    subject,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, data: info };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}
