import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#131313] text-white">
      <div className="flex-1 w-full flex flex-col pt-32 pb-24 px-6 md:px-12">
        <div className="max-w-4xl mx-auto w-full">
          <FadeIn className="space-y-6">
            <span className="text-[#B6916D] font-headline font-bold uppercase tracking-widest text-sm">Legal</span>
            <h1 className="text-white font-headline font-black text-4xl md:text-6xl uppercase tracking-tighter mb-12">Privacy Policy</h1>
            
            <div className="space-y-8 text-[#ababab] text-sm md:text-base leading-relaxed font-body">
              <section>
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest mb-4">1. Introduction</h2>
                <p>Welcome to GymManagr. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website (regardless of where you visit it from) and tell you about your privacy rights and how the law protects you.</p>
              </section>
              
              <section>
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest mb-4">2. Data We Collect</h2>
                <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
                <ul className="list-disc pl-6 mt-4 space-y-2">
                  <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
                  <li><strong>Contact Data</strong> includes billing address, delivery address, email address and telephone numbers.</li>
                  <li><strong>Financial Data</strong> includes bank account and payment card details.</li>
                  <li><strong>Transaction Data</strong> includes details about payments to and from you and other details of products and services you have purchased from us.</li>
                </ul>
              </section>
              
              <section>
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest mb-4">3. How We Use Your Data</h2>
                <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
                <ul className="list-disc pl-6 mt-4 space-y-2">
                  <li>Where we need to perform the contract we are about to enter into or have entered into with you.</li>
                  <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
                  <li>Where we need to comply with a legal obligation.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-white font-headline font-bold text-xl uppercase tracking-widest mb-4">4. Contact Us</h2>
                <p>If you have any questions about this privacy policy or our privacy practices, please contact us at support@gymmanagr.com.</p>
              </section>
            </div>
          </FadeIn>
        </div>
      </div>
      <Footer />
    </div>
  );
}
