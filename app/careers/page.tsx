"use client";

import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function CareersPage() {
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    
    if (!/^[6-9]\d{9}$/.test(data.contact as string)) {
      toast({
        title: "Invalid Contact",
        description: "Mobile number must be 10 digits starting with 6, 7, 8, or 9.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        toast({
          title: "Application Sent!",
          description: "We've received your inquiry and will get back to you soon.",
        });
        form.reset();
        setSelectedRole(null);
      } else {
        toast({
          title: "Error",
          description: "Failed to send application. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "An unexpected error occurred. Check your connection.",
        variant: "destructive",
      });
    }
  };

  const renderForm = (role: string) => {
    if (selectedRole !== role) return null;
    return (
      <div className="mt-8 pt-8 border-t border-white/10 w-full animate-in fade-in duration-300">
        <h4 className="font-headline font-bold text-lg tracking-widest uppercase text-white mb-6">Apply for {role}</h4>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col gap-2">
              <input required name="name" type="text" placeholder="NAME" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-6 py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
            </div>
            <div className="flex flex-col gap-2">
              <input required name="contact" type="text" placeholder="CONTACT" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-6 py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
            </div>
            <div className="flex flex-col gap-2">
              <input required name="email" type="email" placeholder="EMAIL" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-6 py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <input required readOnly name="subject" value={role} className="w-full bg-[#131313] border border-white/10 text-white/50 font-headline tracking-widest text-xs px-6 py-5 focus:outline-none transition-colors cursor-not-allowed" />
          </div>
          <div className="flex flex-col gap-2">
            <input required name="city" type="text" placeholder="CITY" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-6 py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
          </div>
          <div className="flex flex-col gap-2 relative">
            <textarea required name="message" placeholder="WHY ARE YOU A GOOD FIT? (COVER LETTER / PORTFOLIO LINK)" rows={4} className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-6 py-5 focus:outline-none focus:border-[#B6916D] transition-colors resize-none"></textarea>
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={() => setSelectedRole(null)} className="text-[#ababab] hover:text-white px-6 py-4 font-headline font-bold text-xs tracking-widest uppercase transition-colors">
              CANCEL
            </button>
            <button type="submit" className="bg-transparent border border-[#B6916D] text-[#B6916D] px-12 py-4 font-headline font-bold text-xs tracking-widest uppercase hover:bg-[#B6916D] hover:text-white transition-all">
              SUBMIT APPLICATION
            </button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#131313] text-white">
      <div className="flex-1 w-full flex flex-col pt-32 pb-24 px-6 md:px-12">
        <div className="max-w-5xl mx-auto w-full">
          <FadeIn className="space-y-6 text-center mb-20">
            <span className="text-[#B6916D] font-headline font-bold uppercase tracking-widest text-sm">Join the Elite</span>
            <h1 className="text-white font-headline font-black text-4xl md:text-6xl uppercase tracking-tighter mb-6">Careers</h1>
            <p className="max-w-2xl mx-auto text-[#ababab] text-base md:text-lg leading-relaxed font-body">
              We are always looking for driven professionals who share our passion for elite performance and uncompromising quality. Check out our open roles below.
            </p>
          </FadeIn>

          <div className="space-y-6">
              {/* Job 1 */}
              <div className="bg-[#181818] border border-white/5 p-8 flex flex-col group hover:border-[#B6916D] transition-all duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full">
                      <div>
                          <h3 className="text-2xl font-headline font-black uppercase text-white tracking-widest mb-2">Senior Personal Trainer</h3>
                          <p className="text-[#ababab] font-headline text-xs tracking-widest uppercase">Full-Time • Remote / HQ</p>
                      </div>
                      {selectedRole !== "Senior Personal Trainer" && (
                          <button onClick={() => setSelectedRole("Senior Personal Trainer")} className="mt-6 md:mt-0 bg-transparent border border-[#B6916D] text-[#B6916D] px-8 py-3 font-headline font-bold text-xs tracking-widest uppercase hover:bg-[#B6916D] hover:text-white transition-all">
                              Apply Now
                          </button>
                      )}
                  </div>
                  {renderForm("Senior Personal Trainer")}
              </div>

              {/* Job 2 */}
              <div className="bg-[#181818] border border-white/5 p-8 flex flex-col group hover:border-[#B6916D] transition-all duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full">
                      <div>
                          <h3 className="text-2xl font-headline font-black uppercase text-white tracking-widest mb-2">Facility Manager</h3>
                          <p className="text-[#ababab] font-headline text-xs tracking-widest uppercase">Full-Time • Remote / HQ</p>
                      </div>
                      {selectedRole !== "Facility Manager" && (
                          <button onClick={() => setSelectedRole("Facility Manager")} className="mt-6 md:mt-0 bg-transparent border border-[#B6916D] text-[#B6916D] px-8 py-3 font-headline font-bold text-xs tracking-widest uppercase hover:bg-[#B6916D] hover:text-white transition-all">
                              Apply Now
                          </button>
                      )}
                  </div>
                  {renderForm("Facility Manager")}
              </div>

              {/* Job 3 */}
              <div className="bg-[#181818] border border-white/5 p-8 flex flex-col group hover:border-[#B6916D] transition-all duration-300">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center w-full">
                      <div>
                          <h3 className="text-2xl font-headline font-black uppercase text-white tracking-widest mb-2">Nutrition Specialist</h3>
                          <p className="text-[#ababab] font-headline text-xs tracking-widest uppercase">Full-Time • Remote / HQ</p>
                      </div>
                      {selectedRole !== "Nutrition Specialist" && (
                          <button onClick={() => setSelectedRole("Nutrition Specialist")} className="mt-6 md:mt-0 bg-transparent border border-[#B6916D] text-[#B6916D] px-8 py-3 font-headline font-bold text-xs tracking-widest uppercase hover:bg-[#B6916D] hover:text-white transition-all">
                              Apply Now
                          </button>
                      )}
                  </div>
                  {renderForm("Nutrition Specialist")}
              </div>
          </div>

          <div className="mt-20 text-center">
              <p className="text-[#ababab] font-body text-sm mb-6">Don't see a role that fits? We're always open to meeting top talent.</p>
              <Link href="/#contact-form">
                  <button className="bg-[#B6916D] text-white px-10 py-4 font-headline font-bold text-xs tracking-widest uppercase hover:bg-white hover:text-[#B6916D] transition-all">
                      Send General Application
                  </button>
              </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
