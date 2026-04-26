import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#131313] text-white">
      <div className="flex-1 w-full flex flex-col pt-32 pb-24 px-6 md:px-12">
        <div className="max-w-4xl mx-auto w-full">
          <FadeIn className="space-y-6">
            <span className="text-[#B6916D] font-headline font-bold uppercase tracking-widest text-sm">Legal</span>
            <h1 className="text-white font-headline font-black text-4xl md:text-6xl uppercase tracking-tighter mb-12">Terms of Service</h1>
            
            <div className="space-y-12 text-[#ababab] text-sm md:text-base leading-relaxed font-body text-justify">
              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">1. Agreement to Terms</h2>
                <p>
                  By accessing or using the GymManagr software platform ("the Platform"), you agree to be bound by these Terms of Service. If you are using the Platform on behalf of an organization, you are agreeing to these terms for that organization and representing that you have the authority to bind that organization to these terms. In that case, "you" and "your" will refer to that organization.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">2. Description of Service</h2>
                <p>
                  GymManagr provides a cloud-based software-as-a-service (SaaS) tool designed for gym and fitness center management. This includes member registration, billing, staff management, and analytics. We reserve the right to modify or discontinue, temporarily or permanently, the Platform (or any part thereof) with or without notice.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">3. Accounts & Security</h2>
                <ul className="list-disc pl-5 space-y-3">
                    <li>You must provide accurate and complete information when creating an account.</li>
                    <li>You are responsible for safeguarding your password and for any activities or actions under your account.</li>
                    <li>You agree to notify us immediately of any unauthorized use of your account or any other breach of security.</li>
                    <li>GymManagr cannot and will not be liable for any loss or damage arising from your failure to comply with the above.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">4. Subscription Fees & Payment</h2>
                <p>
                  Certain parts of the Platform are billed on a subscription basis. You will be billed in advance on a recurring and periodic basis (monthly or annually). GymManagr reserves the right to modify subscription fees at any time, upon reasonable notice. All fees are non-refundable unless required by law or as specifically stated in these terms.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">5. Data Ownership & Privacy</h2>
                <p>
                  <strong>Customer Data:</strong> You retain all right, title, and interest in and to the data you input into the Platform regarding your members, staff, and operations. 
                </p>
                <p>
                  <strong>Our Data:</strong> We own and retain all right, title, and interest in the Platform, including all software, design, and intellectual property. 
                </p>
                <p>
                  We will handle your data in accordance with our <a href="/privacy-policy" className="text-[#B6916D] hover:underline">Privacy Policy</a>.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">6. Acceptable Use</h2>
                <p>You agree not to use the Platform to:</p>
                <ul className="list-disc pl-5 space-y-3">
                    <li>Upload or transmit any content that is unlawful, harmful, or infringes on third-party rights.</li>
                    <li>Reverse engineer, decompile, or attempt to extract the source code of the Platform.</li>
                    <li>Interfere with or disrupt the security or performance of the Platform.</li>
                    <li>Use the Platform for any fraudulent or unauthorized purpose.</li>
                </ul>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">7. Limitation of Liability</h2>
                <p>
                  To the maximum extent permitted by law, GymManagr shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">8. Governing Law</h2>
                <p>
                  These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any dispute arising from these terms shall be subject to the exclusive jurisdiction of the courts in Mumbai, India.
                </p>
              </section>

              <section className="space-y-4">
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest border-b border-white/10 pb-4">9. Contact Us</h2>
                <p>
                  If you have any questions about these Terms, please contact us at:
                  <br />
                  <span className="text-[#B6916D]">Email: support@gymmanagr.com</span>
                </p>
              </section>
            </div>
          </FadeIn>
        </div>
      </div>
      <Footer />
    </div>
  );
}
