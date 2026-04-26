import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer id="contact" className="bg-[#0e0e0e] py-20 px-6 border-t border-white/10 text-[#e5e2e1] w-full mt-auto">
      <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-20 text-white">
        <div className="md:col-span-1">
          <Image src="/logo.png" alt="Vyom Logo" width={120} height={40} className="mb-8 object-contain" />
          <p className="font-body text-[#dcdcdc] text-sm leading-relaxed mb-6">
              THE ARCHITECTURAL STANDARD FOR ELITE PERFORMANCE. KINETIC MONOLITH TRAINING SYSTEMS.
          </p>
        </div>
        <div className="md:col-span-1">
          <h4 className="font-headline font-bold text-sm tracking-widest uppercase mb-8 text-white">MORE ABOUT</h4>
          <ul className="space-y-4 font-headline text-xs tracking-widest text-[#dcdcdc] mb-8">
            <li><Link className="hover:text-[#B6916D] transition-colors" href="/privacy-policy">PRIVACY POLICY</Link></li>
            <li><Link className="hover:text-[#B6916D] transition-colors" href="/terms-of-use">TERMS OF USE</Link></li>
            <li><Link className="hover:text-[#B6916D] transition-colors" href="/our-story">OUR STORY</Link></li>
            <li><Link className="hover:text-[#B6916D] transition-colors" href="/careers">CAREERS</Link></li>
          </ul>
          <div>
              <h4 className="font-headline font-bold text-sm tracking-widest uppercase mb-4 text-white">CONTACT</h4>
              <p className="font-headline text-xs tracking-widest text-[#dcdcdc]">info@vyomgymandclub.com</p>
              <p className="font-headline text-xs tracking-widest text-[#dcdcdc]">+91 99994 03888</p>
          </div>
        </div>
        <div className="md:col-span-2 flex flex-col">
          <h4 className="font-headline font-bold text-sm tracking-widest uppercase mb-8 text-white">FIND THE GYM</h4>
          <div className="w-full flex-grow min-h-[250px] relative group overflow-hidden border border-white/10">
            <iframe 
              src="https://maps.google.com/maps?q=VYOM%20LUXURY%20GYM%20AND%20WELLNESS&t=&z=15&ie=UTF8&iwloc=&output=embed"
              className="absolute inset-0 w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-500" 
              allowFullScreen={false} 
              loading="lazy" 
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>
            <Link href="https://maps.app.goo.gl/hT5EJd2iBbCpDS3w7" target="_blank" className="absolute inset-0 z-10 opacity-0 group-hover:opacity-100 bg-black/40 flex items-center justify-center transition-all duration-300">
              <span className="bg-[#B6916D] text-white px-6 py-3 font-headline font-bold tracking-widest text-xs uppercase">Open in Maps</span>
            </Link>
          </div>
        </div>
      </div>
      <div className="max-w-screen-xl mx-auto pt-8 border-t border-white/10 text-center">
        <p className="font-headline text-[10px] tracking-[0.3em] text-[#dcdcdc]/50 uppercase">
          © 2026 VYOM GYM & CLUB. ALL RIGHTS RESERVED.
        </p>
      </div>
    </footer>
  );
}
