import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";

export default function TermsOfUsePage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const gymName = (searchParams?.gym as string) || "the Gym";

  return (
    <div className="flex flex-col min-h-screen bg-[#131313] text-white">
      <div className="flex-1 w-full flex flex-col pt-32 pb-24 px-6 md:px-12">
        <div className="max-w-4xl mx-auto w-full">
          <FadeIn className="space-y-6">
            <span className="text-[#B6916D] font-headline font-bold uppercase tracking-widest text-sm">Legal</span>
            <h1 className="text-white font-headline font-black text-4xl md:text-6xl uppercase tracking-tighter mb-12">Terms & Conditions</h1>
            
            <div className="space-y-12 text-[#ababab] text-sm md:text-base leading-relaxed font-body text-justify">
              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">General Terms</h2>
                <ul className="list-disc pl-5 space-y-3">
                    <li>{gymName} management reserves the right to increase the membership fee at the time of renewal of membership.</li>
                    <li>Membership is personal. Fees once paid are strictly non-refundable, non-adjustable, and non-transferable at any case.</li>
                    <li>The Member agrees to pay the membership fees on time. The Member agrees to pay all costs incurred by the gym towards realisation of the due membership fee.</li>
                    <li>The Member shall never permit any person, other than himself or herself, to enter {gymName}. If any person, other than the Member, is found using the same to access {gymName}, then the membership of the Member who has allowed access to such person shall stand immediately terminated without any notice, and the Member shall not be entitled to any refund of membership fee. The trespasser shall be asked to leave the premises and upon payment of a fee equal to twice (2) the one (1) day guest pass fee for each day of default. If the trespasser does not pay such fees, the Member, who allowed access to such trespasser, shall be liable to pay for the same.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Membership Type</h2>
                <p>Several types of membership are offered at {gymName}. The privileges applicable to the membership type chosen may vary. Each membership type includes the following core services:</p>
                <ol className="list-[lower-alpha] pl-5 space-y-2">
                    <li>access during regular hours of operations;</li>
                    <li>use of all available machinery / equipments (cardio, strength, free-weight, BCA);</li>
                    <li>group studio classes as determined by us from time to time.</li>
                </ol>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Gym Etiquettes</h2>
                <p>The Member shall ensure that:</p>
                <ol className="list-[lower-roman] pl-5 space-y-2">
                    <li>towels & deodorant are used at all times, for hygiene reasons;</li>
                    <li>only sports shoes must be worn for workouts;</li>
                    <li>getting non-members along is not permitted;</li>
                    <li>he/she does not block equipment / machinery;</li>
                    <li>free-weights are racked in the right place after use;</li>
                    <li>weights are not dropped / thrown on the floor;</li>
                    <li>discipline shall be maintained at all times;</li>
                    <li>he/she signs the membership register;</li>
                    <li>he/she at all times abides by rules of conduct, behaviour, dress code, equipment usage, and use of services that are displayed within the {gymName};</li>
                    <li>he/she does not open the door for anyone; and</li>
                    <li>photography and/or videography by the Member does not violate privacy of any other Member.</li>
                </ol>
                <p>Use of the recovery room is determined as per the needs by the fitness manager.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Additional Services</h2>
                <p>Personal training and other special services are offered at {gymName}. These services will be provided for an additional charge or fees. Such services are governed by {gymName} Regulations. Personal training services shall be provided by employees of the gym or by independent contractors retained by the gym. Regardless, all payments for such services shall be made directly to {gymName}.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Guest Policy</h2>
                <p>All non-members will be charged a guest fee. Any guest using the {gymName} without paying guest fee shall be charged a fee equivalent to twice (2) the one (1) day guest pass fee for each day of default. All guests / non-members shall abide by the terms and conditions of this agreement and {gymName} Regulations.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Freeze Policy</h2>
                <p>Subject to the sole discretion of the Management, a Member may be permitted to freeze his/her membership. The Management may, on application from the Member in person, freeze the membership term for a maximum period of 1 (one) month. It is pertinent to mention that this option is only available for Members availing annual memberships and/or semi-annual membership. The payments due and payable during the freeze period shall be payable immediately after expiry of the freeze period.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Prohibited Substances & Declarations</h2>
                <p>I declare that I am not using any illegal drugs or performance-enhancing substances. If found otherwise, my membership may be terminated without refund. The gym maintains a zero-tolerance policy for such activities inside the premises.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Cancellation of Membership</h2>
                <p>{gymName} retains the right to cancel or suspend the membership of any Member who violates the gym regulations. In case a Member is responsible for damaging any property / equipment of {gymName}, the Member shall be responsible for the repair or replacement, or payment of damages as estimated by the Management.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Security, Personal Belongings & Parking</h2>
                <ul className="list-disc pl-5 space-y-3">
                    <li>{gymName} is equipped with 24 hour video surveillance technology which is constantly recording for the security of the premises. Members must use caution at the time of entering and exiting the gym. {gymName} may be equipped with an emergency button to notify staff in case the Member requires medical help or feels threatened.</li>
                    <li>The gym management is not responsible for any loss or damage to personal belongings inside the premises.</li>
                    <li>Vehicle parking is at the owner's risk. The gym is not liable for any loss or damage.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Assumption of Risk & Medical Clearance</h2>
                <p>I confirm that the health information provided by me is true. I understand that exercise involves risk, and the gym will not be responsible for any injury or medical issue during training. I understand the risk of all injuries from activities and/or using any equipment at the {gymName}. I understand that such risk is significant and can result in permanent or partial paralysis and death. I knowingly and freely assume all such risks, both known and unknown.</p>
                <p>I acknowledge that this is a supervised fitness centre / health club and I assume all risks associated with or without using exercise equipment and exercising alone without the aid and presence of staff on the premises. I hereby release, indemnify, and hold harmless the gym management and staff with respect to any and all injury, disability, death, loss or damage to me and/or any other person and/or property that may arise out of or in connection with my use of any of the equipment or facilities or activities or any other incident that occurs at the {gymName}.</p>
                <p>I undertake to never make any defamatory statements against {gymName} or its staff. I shall be held liable for any defamatory statement and the management shall have the right to terminate my membership due to this breach without any liability whatsoever.</p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">Governing Law and Dispute Resolution</h2>
                <p>I understand that the validity, construction and performance of this agreement and {gymName} Regulations shall be interpreted in accordance with the laws of India. Any disputes and differences arising in relation to, under or in connection with this agreement or {gymName} Regulations shall be settled by Arbitration, in accordance with the provisions of the Arbitration & Conciliation Act, 1996 and terms and conditions stipulated in {gymName} Regulations.</p>
              </section>
            </div>
          </FadeIn>
        </div>
      </div>
      <Footer />
    </div>
  );
}
