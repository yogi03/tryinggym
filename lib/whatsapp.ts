/**
 * WhatsApp Meta Cloud API Wrapper
 * Requirements:
 * - WHATSAPP_API_TOKEN
 * - WHATSAPP_PHONE_NUMBER_ID
 */

export async function sendWhatsAppMessage(toPhone: string, messageBody: string) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error("WhatsApp configuration missing. Please ensure WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID are set.");
    return { success: false, error: "Missing WhatsApp credentials" };
  }

  // Format phone number: remove any non-numeric characters, add country code if missing
  let cleanPhone = toPhone.replace(/\D/g, '');
  // Default to India +91 if length is 10
  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          preview_url: true, // Helpful for URLs like Terms of Service
          body: messageBody,
        },
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("WhatsApp API Error:", data);
      return { success: false, error: data.error?.message || "Failed to send message" };
    }

    return { success: true, data };
  } catch (error) {
    console.error("WhatsApp Fetch Error:", error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Example Template Sender (Meta often requires templates for business-initiated messages outside 24h window)
 * Included here for future use if you setup templates in your Meta dashboard.
 */
export async function sendWhatsAppTemplate(toPhone: string, templateName: string, languageCode = "en", components: any[] = []) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return { success: false, error: "Missing WhatsApp credentials" };
  }

  let cleanPhone = toPhone.replace(/\D/g, '');
  if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;

  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components: components,
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) return { success: false, error: data.error?.message };
    return { success: true, data };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
