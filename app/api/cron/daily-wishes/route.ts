import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collectionGroup, getDocs, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

const FESTIVALS: Record<string, string> = {
  // Fixed Dates (Matches MM-DD)
  "01-01": "New Year",
  "01-14": "Makar Sankranti",
  "01-26": "Republic Day",
  "08-15": "Independence Day",
  "10-02": "Gandhi Jayanti",
  "12-25": "Christmas",
  
  // Specific Dates for Lunar Calendar 2024 (Matches YYYY-MM-DD)
  "2024-03-08": "Maha Shivaratri",
  "2024-03-25": "Holi",
  "2024-04-10": "Eid al-Fitr",
  "2024-07-17": "Muharram",
  "2024-08-19": "Raksha Bandhan",
  "2024-10-03": "Navratri",
  "2024-10-12": "Dussehra",
  "2024-10-31": "Diwali",
  "2024-11-07": "Chhath Puja",

  // Specific Dates for Lunar Calendar 2025
  "2025-02-26": "Maha Shivaratri",
  "2025-03-14": "Holi",
  "2025-03-31": "Eid al-Fitr",
  "2025-08-09": "Raksha Bandhan",
  "2025-09-22": "Navratri",
  "2025-10-02": "Dussehra (Vijayadashami)",
  "2025-10-20": "Diwali",
  "2025-10-26": "Chhath Puja",
};

export async function GET(req: Request) {
  try {
    // Authenticate CRON request
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const today = new Date();
    // Use local time offset if needed. ISO string relies on UTC
    // Considering IST offset (+5:30) roughly for daily wishes:
    const istOffset = 5.5 * 60 * 60 * 1000; 
    const localDate = new Date(today.getTime() + istOffset);
    
    const todayStr = localDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
    const mmDD = todayStr.substring(5); // "MM-DD"

    const currentFestival = FESTIVALS[todayStr] || FESTIVALS[mmDD];

    // Fetch all members across all gyms
    const querySnapshot = await getDocs(collectionGroup(db, 'members'));

    const sentWishes = [];
    const errors = [];
    const gymCache: Record<string, string> = {};

    for (const memberDoc of querySnapshot.docs) {
      const member = memberDoc.data();
      const gymId = memberDoc.ref.parent.parent?.id;
      
      if (!member.phone || member.archiveType || !gymId) continue;

      // Get Gym Name (with simple cache)
      if (!gymCache[gymId]) {
        const gymSnap = await getDoc(firestoreDoc(db, 'gyms', gymId));
        gymCache[gymId] = gymSnap.exists() ? (gymSnap.data()?.name || 'the Gym') : 'the Gym';
      }
      const gymName = gymCache[gymId];

      let whatsappText = "";

      // 1. Check Birthday
      let isBirthday = false;
      if (member.dob) {
        // dob format: YYYY-MM-DD
        const dobMMDD = member.dob.substring(5);
        if (dobMMDD === mmDD) {
          isBirthday = true;
          whatsappText += `🎉 *Happy Birthday, ${member.fullName}!* 🎂\n\nWishing you a fantastic day filled with joy, health, and fitness. Keep crushing your goals!\n\nBest Wishes,\n${gymName}`;
        }
      }

      // 2. Check Festival 
      // If it's both a birthday and a festival, we send separate messages or combine. We'll send one combined if both.
      if (currentFestival) {
        if (isBirthday) {
          // Send Birthday wish first
          try {
            await sendWhatsAppMessage(member.phone, whatsappText);
          } catch (e: any) {
            errors.push({ phone: member.phone, type: 'birthday', error: e.message });
          }
          whatsappText = `🌟 *Happy ${currentFestival}!* 🌟\n\nWishing you and your family joy, prosperity, and great health.\n\n— ${gymName}`;
        } else {
          whatsappText = `🌟 *Happy ${currentFestival}!* 🌟\n\nHello ${member.fullName},\nWishing you and your family joy, prosperity, and great health on this auspicious occasion.\n\n— ${gymName}`;
        }
      }

      if (whatsappText) {
        try {
          await sendWhatsAppMessage(member.phone, whatsappText);
          sentWishes.push({ phone: member.phone, type: currentFestival && isBirthday ? 'both' : (isBirthday ? 'birthday' : 'festival') });
        } catch (err: any) {
          console.error(`Failed to send wish to ${member.phone}:`, err);
          errors.push({ phone: member.phone, type: 'wish', error: err.message });
        }
      }
    }

    return NextResponse.json({ success: true, count: sentWishes.length, sentWishes, errors });
  } catch (error: any) {
    console.error("Cron daily-wishes error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
