import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { collection, collectionGroup, getDocs, query, where, doc as firestoreDoc, getDoc } from 'firebase/firestore';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function GET(req: Request) {
  try {
    // Authenticate CRON request
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get tomorrow's date string (YYYY-MM-DD)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Fetch all members across all gyms
    // We use collectionGroup to query all 'members' subcollections
    const membersQuery = query(collectionGroup(db, 'members'), where('membershipEndDate', '==', tomorrowStr));
    const querySnapshot = await getDocs(membersQuery);

    const gymCache: Record<string, string> = {};

    for (const memberDoc of querySnapshot.docs) {
      const member = memberDoc.data();
      const gymId = memberDoc.ref.parent.parent?.id;
      
      // Ignore archived members or members without phones or if no gymId
      if (!member.phone || member.archiveType || !gymId) continue;

      // Get Gym Name (with simple cache)
      if (!gymCache[gymId]) {
        const gymSnap = await getDoc(firestoreDoc(db, 'gyms', gymId));
        gymCache[gymId] = gymSnap.exists() ? (gymSnap.data()?.name || 'the Gym') : 'the Gym';
      }
      const gymName = gymCache[gymId];
      
      // Double check plan history for any upcoming plans starting after tomorrow just in case
      let hasUpcomingPlan = false;
      if (member.planHistory && Array.isArray(member.planHistory)) {
        for (const plan of member.planHistory) {
          if (plan.startDate > tomorrowStr) {
            hasUpcomingPlan = true;
            break;
          }
        }
      }

      if (hasUpcomingPlan) {
        continue;
      }

      const whatsappText = `*Membership Expiring Soon* ⏳

Hello ${member.fullName},
Your membership at ${gymName} is expiring tomorrow (${tomorrowStr}).

Please renew your membership to continue enjoying our services without interruption.
If you have already renewed, please ignore this message.

Thank you,
— ${gymName}`;

      try {
        await sendWhatsAppMessage(member.phone, whatsappText);
        sentTo.push(member.phone);
      } catch (err: any) {
        console.error(`Failed to send reminder to ${member.phone}:`, err);
        errors.push({ phone: member.phone, error: err.message });
      }
    }

    return NextResponse.json({ success: true, count: sentTo.length, sentTo, errors });
  } catch (error: any) {
    console.error("Cron membership-reminders error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
