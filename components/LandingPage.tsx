"use client";

import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { FadeIn } from "@/components/FadeIn";
import {
  Dumbbell,
  Users,
  Activity,
  Apple,
  ChevronDown,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const testimonials = [
  {
    quote: "JOINING THIS GYM COMPLETELY TRANSFORMED NOT ONLY MY PHYSIQUE BUT MY ENTIRE MINDSET TOWARDS ELITE PERFORMANCE. THE VYOM COMMUNITY IS UNMATCHED.",
    name: "GLORIA GORDON",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCxscZh4SVcW86_-FnWFJKWchl_uqmqGPpE2mgwu8XznpAwki6VN1FvRghfar9KjqItoFLtBL7T43ziJbfTAaow-9ywrJ3uc1FwqfZIG234q4FaetZBc_J9zAW8IqyOQvbLnlKVsqrjsHggLLuh7gqaVCD2owsN1G4hlHWoQzldGL_FCTcU1jzYIqib91zKx2t-Kp3YhA_H-mOoaDVDRU60Grs4Ueesx2wJRZO6kcLZIFOr6rayD-ocTnYVPwRbb_wqdCbAn1MegVw"
  },
  {
    quote: "THE COACHING ALONE IS WORTH THE INVESTMENT. I'VE SHATTERED EVERY PERSONAL RECORD SINCE I STARTED TRAINING HERE. IT'S A WHOLE NEW LEVEL.",
    name: "MARCUS TRENT",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAc4zJOdmSdPbMw2uwaw-GDG37RbTHLWpQ7SFQzCkfTmXswZJ5uCXczngtRPNc-7FuINBUC1Td6gz-vBFgOmDH9pJXDutEcJaLd_dhfq-O9NuRBRjCUJX89zT59eIlV36EG4iVWQWjXMCOLjd1x-hHnDuPZDHtYP5UpatgmtZERYjjTTVpuO0iKNKnj_LAfEPXS8D222hwInktbCXF7oHA0wN4VAl0P6ZkBt_S6zLYaK2MNGIzBAehRALBQeiSu_SmMSAEpMPjwoV0"
  },
  {
    quote: "I'VE NEVER EXPERIENCED AN ATMOSPHERE QUITE LIKE THIS. THE EQUIPMENT, THE ENERGY, THE CONSTANT PUSH TO BE EXCELLENT—IT'S ADDICTIVE.",
    name: "ELENA ROSTOVA",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuABnuJL7ww7jc_MTw9g3QZC1dFDQdZ2fxdk5qu7T7T17bZmaKQQjpa3trjvugw5rK4FJ5jsZScWqJRvJMC_cvfraeLvFMM4yIEC57d-dCVN-d2TBRICHjCZD8KPp0c39Bqud0TOxjzdjr6-AjBfochACxCo6NOj-oXo4-lelQ35hutl2DUbGN7NhN7VDLh1LZRisWMRyrz76r9AOPDikqdytpeUfgenkrZdXMF5K2Ydt8_RAeffKXwIrLbvfWc6Yq6odiWm-OsVv_U"
  }
];

export default function LandingPage() {
  const { toast } = useToast();
  const [scrollY, setScrollY] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const nextTestimonial = () => {
    setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
  };
  
  const prevTestimonial = () => {
    setActiveTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <div className="w-full flex flex-col bg-[#131313] text-white overflow-x-hidden font-body">

      {/* Hero Section */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-black/40 z-10"></div>
        <Image 
          className="absolute inset-0 w-full h-full object-cover grayscale brightness-50" 
          alt="dramatic wide shot of a high-end brutalist gym interior" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuAEXJH73u1VTFaas9i_gF_CQvMFo0cfn5zRiv-6LPFdnq2Jq5ckeIu5YVBpBCcmldYp8luo7jM_WdmO9cp9InTjR_jR3HQaQn35WmHAy3vibp4JyvIJJgUR3NSqvE8Q9EaFJ1UDTtqu-EJzo2CUCqNwy_KJKkFrN9nVkUIU60r3e6FOe6SScA4UjUo7VcxZvUEbN5Q_5fByfNBpiCD7VuYY2QFPa284VrTpI7AZIQTphXMgMmb2B03k4lqtjLIAFWEhd1ayCrciPH8"
          fill
          priority
          sizes="100vw"
        />
        <div className="relative z-20 text-center px-4 sm:px-6 max-w-5xl mt-24">
          <FadeIn delay={100}>
            <h1 
              className="font-headline font-black text-[clamp(1.75rem,6vw,4.5rem)] tracking-[0.1em] md:tracking-[0.15em] uppercase leading-[1.1] mb-6 transition-transform duration-75 ease-out"
              style={{ transform: `translateY(-${scrollY * 0.3}px)` }}
            >
              <span className="whitespace-nowrap inline-flex items-center">
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>N</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>O</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>T</span>
                <span className="w-2 md:w-6 inline-block"></span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>Y</span>
                <span className="text-white">O</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>U</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>R</span>
              </span>
              <br/>
              <span className="whitespace-nowrap inline-flex items-center">
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>T</span>
                <span className="text-white">Y</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>P</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>I</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>C</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>A</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>L</span>
                <span className="w-4 md:w-10 inline-block"></span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>F</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>I</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>T</span>
                <span className="text-white">N</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>E</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>S</span>
                <span className="text-transparent" style={{ WebkitTextStroke: '1px white' }}>S</span>
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={300}>
            <p className="font-headline text-[#B6916D] text-[10px] sm:text-xs md:text-sm tracking-[0.15em] sm:tracking-[0.2em] font-bold mb-10">
              UNLOCK 10% OFF YOUR FIRST MONTH GYM FEE AT VYOM!
            </p>
            <Link href="/trial?gym=vyom-gym-club-qf7mj8">
              <button className="bg-[#B6916D] text-white px-6 sm:px-8 md:px-12 py-3 sm:py-4 font-headline text-xs md:text-sm font-black tracking-widest uppercase hover:bg-white hover:text-[#B6916D] transition-all duration-150">
                GET STARTED NOW
              </button>
            </Link>
          </FadeIn>
        </div>
        <div className="absolute bottom-10 right-10 z-20 hidden md:flex flex-col items-center">
          <FadeIn delay={600}>
            <div className="relative w-24 h-24 flex items-center justify-center group cursor-pointer hover:scale-110 transition-transform">
              <svg className="absolute inset-0 w-full h-full animate-[spin_10s_linear_infinite]" viewBox="0 0 100 100">
                <path id="circlePath" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" fill="transparent" />
                <text className="font-headline text-[10px] md:text-[11px] tracking-[0.3em] uppercase fill-white/80 font-bold">
                  <textPath href="#circlePath" startOffset="0%">SCROLL DOWN • SCROLL DOWN • </textPath>
                </text>
              </svg>
              <div className="w-12 h-12 bg-[#B6916D] rounded-full flex items-center justify-center z-10 transition-transform group-hover:bg-white group-hover:text-[#B6916D]">
                <ChevronDown className="text-current w-6 h-6" />
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Facilities Section */}
      <section id="facilities" className="relative py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#131313] overflow-hidden">
        {/* Gradients */}
        <div className="absolute top-1/2 left-[-150px] -translate-y-1/2 w-[300px] h-[500px] bg-[#B6916D] opacity-30 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/2 right-[-150px] -translate-y-1/2 w-[300px] h-[500px] bg-[#B6916D] opacity-30 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-screen-xl mx-auto text-center">
          <FadeIn>
            <h2 className="font-headline font-black text-2xl sm:text-3xl md:text-5xl uppercase tracking-tighter mb-12 sm:mb-16 lg:mb-20 max-w-3xl mx-auto leading-none">
              ACHIEVE AMAZING RESULTS WITH OUR SERVICES
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 lg:gap-12">
            <FadeIn delay={0}>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#B6916D]/80 rounded-full flex items-center justify-center mb-4 sm:mb-6 hover:scale-110 transition-transform">
                  <Dumbbell className="text-white w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <span className="font-headline font-bold text-xs sm:text-sm tracking-widest uppercase text-white">Elite Equipment</span>
                <p className="text-white/60 text-xs mt-2 sm:mt-3 max-w-[200px] leading-relaxed">Train with industry-grade machines for maximum performance and safety.</p>
              </div>
            </FadeIn>
            <FadeIn delay={100}>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#B6916D]/80 rounded-full flex items-center justify-center mb-4 sm:mb-6 hover:scale-110 transition-transform">
                  <Users className="text-white w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <span className="font-headline font-bold text-xs sm:text-sm tracking-widest uppercase text-white">Personal Training</span>
                <p className="text-white/60 text-xs mt-2 sm:mt-3 max-w-[200px] leading-relaxed">Personalized workout programs tailored to your body and fitness goals.</p>
              </div>
            </FadeIn>
            <FadeIn delay={200}>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#B6916D]/80 rounded-full flex items-center justify-center mb-4 sm:mb-6 hover:scale-110 transition-transform">
                  <Apple className="text-white w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <span className="font-headline font-bold text-xs sm:text-sm tracking-widest uppercase text-white">Smart Nutrition</span>
                <p className="text-white/60 text-xs mt-2 sm:mt-3 max-w-[200px] leading-relaxed">Fuel your progress with meal plans and supplements designed for results.</p>
              </div>
            </FadeIn>
            <FadeIn delay={300}>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-[#B6916D]/80 rounded-full flex items-center justify-center mb-4 sm:mb-6 hover:scale-110 transition-transform">
                  <Activity className="text-white w-8 h-8 sm:w-10 sm:h-10" />
                </div>
                <span className="font-headline font-bold text-xs sm:text-sm tracking-widest uppercase text-white">Pool Access</span>
                <p className="text-white/60 text-xs mt-2 sm:mt-3 max-w-[200px] leading-relaxed">Recharge and improve stamina in our professional swimming facility.</p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Split Section / About */}
      <section id="about" className="flex flex-col md:flex-row bg-[#131313]">
        <div className="w-full md:w-1/2 relative min-h-[300px] sm:min-h-[400px] md:min-h-full">
          <FadeIn className="absolute inset-0 w-full h-full">
            <Image 
              className="w-full h-full object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-500" 
              alt="athlete training" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDltPfFIr4LaxrIAi8HsjdnAP2k9ZnkdA95paGIbLMblBO0nxtnxFISisqiKxGoLdCzYKMtfi80psSfIjMGsfcN8K48o_8iT0g72YYYnXUQkM13XztjFq_W5SMycrjoMgwbM46ZG3uC4ffFc2-d42lSIgDY-LbnI0resQr39QR3Uhgyme4PIGU9XvJ0pvrJsDpDSQvmM3wgP6BZLRKVFNj3XOhcYg-T2iK8w9dVU3cD1n6bGCN1MEcbrcEpkXtGto7Onx5pfnGC_9o"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </FadeIn>
        </div>
        <div className="w-full md:w-1/2 p-8 sm:p-12 md:p-16 lg:p-24 flex flex-col justify-center items-start">
          <FadeIn>
            <h2 className="font-headline font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-tighter leading-none mb-6 sm:mb-8 text-white">
              GYM HAS THE POWER TO CHANGE YOUR LIFE
            </h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="space-y-4 sm:space-y-6 font-medium text-[#dcdcdc] max-w-lg mb-8 sm:mb-10 leading-relaxed text-sm md:text-base selection:bg-[#a28b5c] selection:text-white">
              <p>WE BELIEVE PERFORMANCE IS AN ARCHITECTURAL PURSUIT. EVERY REP IS A BRICK, EVERY SET IS A FOUNDATION. AT VYOM, WE PROVIDE THE MONOLITHIC STRUCTURE FOR YOUR EVOLUTION.</p>
              <p>JOIN AN ELITE COMMUNITY WHERE LIMITS ARE NON-EXISTENT AND THE ATMOSPHERE IS CHARGED WITH KINETIC ENERGY. OUR MISSION IS YOUR ULTIMATE TRANSFORMATION.</p>
            </div>
          </FadeIn>
          <FadeIn delay={200}>
            <Link href="/our-story">
              <button className="bg-[#B6916D] text-white px-8 sm:px-10 py-3 sm:py-4 font-headline text-xs sm:text-sm font-black tracking-widest uppercase hover:bg-white hover:text-[#B6916D] transition-colors duration-150">
                MORE ABOUT US
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Testimonial Section with Slider */}
      <section className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#0e0e0e]">
        <FadeIn>
          <div className="max-w-screen-md mx-auto text-center">
            <div className="mb-8 sm:mb-10 inline-block overflow-hidden rounded-full border-2 border-[#B6916D]">
              <div className="flex transition-transform duration-500 w-20 h-20 sm:w-24 sm:h-24" style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}>
                {testimonials.map((t, i) => (
                  <Image key={i} className="object-cover flex-shrink-0 grayscale" alt={t.name} src={t.image} width={96} height={96} sizes="96px" />
                ))}
              </div>
            </div>
            
            <div className="overflow-hidden relative mb-8 sm:mb-12">
              <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${activeTestimonial * 100}%)` }}>
                {testimonials.map((t, i) => (
                  <div key={i} className="w-full flex-shrink-0 px-2 sm:px-4">
                    <p className="font-headline italic text-base sm:text-lg md:text-2xl tracking-tight mb-6 sm:mb-8 text-white leading-relaxed">
                      &quot;{t.quote}&quot;
                    </p>
                    <h4 className="font-headline font-black text-[#B6916D] tracking-widest uppercase text-xs sm:text-sm">{t.name}</h4>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-center space-x-4 sm:space-x-6">
              <button onClick={prevTestimonial} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center border border-white/20 hover:border-[#B6916D] text-white hover:text-[#B6916D] transition-colors rounded-full">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button onClick={nextTestimonial} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center border border-[#B6916D] bg-[#B6916D] hover:bg-transparent text-white hover:text-[#B6916D] transition-colors rounded-full">
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Marquee */}
      <div className="bg-[#B6916D] py-3 sm:py-4 overflow-hidden whitespace-nowrap">
        <div className="inline-block animate-marquee font-headline font-black text-white text-xl sm:text-2xl md:text-3xl tracking-[0.2em] uppercase">
          BODYBUILDING &nbsp; BODYBUILDING &nbsp; BODYBUILDING &nbsp; BODYBUILDING &nbsp; BODYBUILDING &nbsp; BODYBUILDING &nbsp; BODYBUILDING &nbsp; BODYBUILDING &nbsp; 
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
        }
        .animate-marquee {
            animation: marquee 20s linear infinite;
        }
      `}} />

      {/* CrossFit Section */}
      <section className="relative py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#131313] overflow-hidden">
        {/* Gradients */}
        <div className="absolute top-1/2 left-[-150px] -translate-y-1/2 w-[300px] h-[500px] bg-[#B6916D] opacity-30 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/2 right-[-150px] -translate-y-1/2 w-[300px] h-[500px] bg-[#B6916D] opacity-30 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-screen-xl mx-auto flex flex-col md:flex-row items-center gap-10 sm:gap-12 lg:gap-16">
          <div className="w-full md:w-1/2">
            <FadeIn>
              <h2 className="font-headline font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-tighter leading-none mb-6 sm:mb-8 text-white">
                FORGE YOUR FITNESS GYM AND CROSSFIT ADVENTURES
              </h2>
              <p className="font-medium text-[#ababab] mb-8 sm:mb-10 max-w-md leading-relaxed text-sm md:text-base">
                BREAK THE CYCLE OF REPETITIVE TRAINING. OUR CROSSFIT ARENA IS DESIGNED FOR RAW POWER, FUNCTIONAL SPEED, AND UNRELENTING ENDURANCE.
              </p>
              <Link href="#contact-form">
                <button className="bg-[#B6916D] text-white px-8 sm:px-10 py-3 sm:py-4 font-headline text-xs sm:text-sm font-black tracking-widest uppercase hover:bg-white hover:text-[#B6916D] transition-colors duration-150">
                  CONTACT US
                </button>
              </Link>
            </FadeIn>
          </div>
          <div className="w-full md:w-1/2 grid grid-cols-2 gap-3 sm:gap-4">
            <FadeIn delay={100} className="pt-8 sm:pt-12">
              <Image 
                className="w-full aspect-[3/4] object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-500" 
                alt="dumbbells" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAl98XibmXTnScwpck-NW5JIsc1rHPJZ0hFCi70PWSZJb3e7LLv60neOMM4dSDuXb5_ULOpLNeETkt-Cyb6LHBMhRI0VqzlR6Q2kbuyC7lhBDm4gXwGA1kz6V9FFXntVq3H2Nx-CI0MAfRF9P3UJ8JBdEAovlABalFCqmylrT0iQHLf0O-C0nKhAJnAkZKnooLwMExVU14qLOaUqD2Bqt1ffSyiIdBhBzMpBWsmCum9c8uTPAF7qrK6rIMb7iNvdnc0Sdhf1KZeazA"
                width={500}
                height={667}
                sizes="(max-width: 768px) 45vw, 25vw"
              />
            </FadeIn>
            <FadeIn delay={200}>
              <Image 
                className="w-full aspect-[3/4] object-cover grayscale brightness-75 hover:grayscale-0 transition-all duration-500" 
                alt="athlete lifting" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCiL2eTCVOIQlkSDVfJlyBVJTkuE5WfE4UY6f3M80fxOjWIwZqcTfYD96VRvTqbmRB06WW2diVWEQkCVwM8ZiAQPZGuWhW1dSdiJLiuOO4P94lcbSqkxA0MqyN6PcGxRlbWyD1cdPqlnuN1Zg7ijcrRQYcQjJQ_Dk5KDUPEaBnuAoJy5Zkko8jc0GkE62BHThOkaqLrYqrGlyBuhw0gK0--YoKWteROZlXA_SldNCTRgV3zS8ppCWD1oxXiiOOJ-SnDWjGRAhhULUw"
                width={500}
                height={667}
                sizes="(max-width: 768px) 45vw, 25vw"
              />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Coaches Section */}
      <section id="coaches" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#1c1b1b]">
        <div className="max-w-screen-xl mx-auto">
          <FadeIn>
            <h2 className="font-headline font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-tighter leading-none text-white mb-12 sm:mb-16 lg:mb-20 text-center">
               TEAM OF EXPERTS COACHES
            </h2>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {/* Coach 1 */}
            <FadeIn delay={0}>
              <div className="relative group h-[350px] sm:h-[400px] md:h-[500px] overflow-hidden bg-white">
                <Image 
                  className="absolute inset-0 w-full h-full object-cover grayscale transition-transform duration-500 group-hover:scale-105" 
                  alt="Matie Simms Junior" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAc4zJOdmSdPbMw2uwaw-GDG37RbTHLWpQ7SFQzCkfTmXswZJ5uCXczngtRPNc-7FuINBUC1Td6gz-vBFgOmDH9pJXDutEcJaLd_dhfq-O9NuRBRjCUJX89zT59eIlV36EG4iVWQWjXMCOLjd1x-hHnDuPZDHtYP5UpatgmtZERYjjTTVpuO0iKNKnj_LAfEPXS8D222hwInktbCXF7oHA0wN4VAl0P6ZkBt_S6zLYaK2MNGIzBAehRALBQeiSu_SmMSAEpMPjwoV0"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-8 right-6 sm:right-8 flex justify-between items-end">
                  <div className="rotate-180 [writing-mode:vertical-lr] font-headline font-black text-[#B6916D] text-xs sm:text-sm tracking-widest uppercase">
                      MATIE SIMMS JUNIOR
                  </div>
                  <div className="text-right">
                      <span className="block font-headline font-black text-base sm:text-lg md:text-xl uppercase tracking-tighter">CROSSFIT COACH</span>
                  </div>
                </div>
              </div>
            </FadeIn>
            {/* Coach 2 */}
            <FadeIn delay={100}>
              <div className="relative group h-[350px] sm:h-[400px] md:h-[500px] overflow-hidden bg-white">
                <Image 
                  className="absolute inset-0 w-full h-full object-cover grayscale transition-transform duration-500 group-hover:scale-105" 
                  alt="Alexa Vandroo" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuABnuJL7ww7jc_MTw9g3QZC1dFDQdZ2fxdk5qu7T7T17bZmaKQQjpa3trjvugw5rK4FJ5jsZScWqJRvJMC_cvfraeLvFMM4yIEC57d-dCVN-d2TBRICHjCZD8KPp0c39Bqud0TOxjzdjr6-AjBfochACxCo6NOj-oXo4-lelQ35hutl2DUbGN7NhN7VDLh1LZRisWMRyrz76r9AOPDikqdytpeUfgenkrZdXMF5K2Ydt8_RAeffKXwIrLbvfWc6Yq6odiWm-OsVv_U"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-8 right-6 sm:right-8 flex justify-between items-end">
                  <div className="rotate-180 [writing-mode:vertical-lr] font-headline font-black text-[#B6916D] text-xs sm:text-sm tracking-widest uppercase">
                      ALEXA VANDROO
                  </div>
                  <div className="text-right">
                      <span className="block font-headline font-black text-base sm:text-lg md:text-xl uppercase tracking-tighter">POWERLIFTING</span>
                  </div>
                </div>
              </div>
            </FadeIn>
            {/* Coach 3 */}
            <FadeIn delay={200}>
              <div className="relative group h-[350px] sm:h-[400px] md:h-[500px] overflow-hidden bg-white">
                <Image 
                  className="absolute inset-0 w-full h-full object-cover grayscale transition-transform duration-500 group-hover:scale-105" 
                  alt="Ryan Kinetic" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1YLmM4xJLSslrnw8C3KMxMjVlMXB5JMyyYjXYq-MVC6qNkdX3ZFEuEdySzlwpAclC7YKIiggJmTmCH03INKJoObJSaIXqYAStoIXuhV2g5B1MgZkWM-RpeqW1qromED_cWKdVERLCiVCSt_YhSBqh5gzXWQ3uKDKJ431ro2MHCE35T4LoNjGj7v9qMU3n0lC2cji1VqSfj9wP1dWlwfi_aZ-TKB0LEulE70ODWNUrxdhLCJsUbowkkuumNOQtZ1zNzNDM0BxBBhQ"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
                <div className="absolute bottom-6 sm:bottom-8 left-6 sm:left-8 right-6 sm:right-8 flex justify-between items-end">
                  <div className="rotate-180 [writing-mode:vertical-lr] font-headline font-black text-[#B6916D] text-xs sm:text-sm tracking-widest uppercase">
                      RYAN KINETIC
                  </div>
                  <div className="text-right">
                      <span className="block font-headline font-black text-base sm:text-lg md:text-xl uppercase tracking-tighter">HIIT SPECIALIST</span>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="relative py-16 sm:py-20 lg:py-24 px-4 sm:px-6 bg-[#181818] overflow-hidden">
        {/* Gradients */}
        <div className="absolute top-1/2 left-[-150px] -translate-y-1/2 w-[300px] h-[500px] bg-[#B6916D] opacity-30 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/2 right-[-150px] -translate-y-1/2 w-[300px] h-[500px] bg-[#B6916D] opacity-30 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="relative z-10 max-w-screen-xl mx-auto flex flex-col md:flex-row gap-10 sm:gap-12 lg:gap-16 items-center">
          <div className="w-full md:w-1/2 flex flex-col justify-center">
            <FadeIn>
              <h2 className="font-headline font-black text-2xl sm:text-3xl md:text-4xl lg:text-5xl uppercase tracking-tighter leading-none mb-4 sm:mb-6 text-white text-left">
                GET IN TOUCH
              </h2>
              <p className="font-medium text-[#ababab] mb-8 sm:mb-10 max-w-md leading-relaxed text-sm md:text-base text-left">
                Ready to elevate your training? Drop us a line regarding memberships, private events, or personal coaching inquiries.
              </p>
            </FadeIn>
          </div>
          <div className="w-full md:w-1/2">
             <FadeIn delay={100}>
               <form className="space-y-4 sm:space-y-6" onSubmit={async (e) => {
                 e.preventDefault();
                 const form = e.currentTarget as HTMLFormElement;
                 const data = Object.fromEntries(new FormData(form).entries());
                 
                  if (!/^[6-9]\d{9}$/.test(data.contact as string)) {
                    toast({
                      title: "Invalid Contact",
                      description: "Contact must be 10 digits starting with 6, 7, 8, or 9.",
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
                        title: "Message Sent!",
                        description: "Check your email soon—we'll reach out shortly.",
                      });
                      form.reset();
                    } else {
                      toast({
                        title: "Error",
                        description: "Failed to send message. Please try again.",
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
               }}>
                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
                   <div className="flex flex-col gap-2">
                     <input required name="name" type="text" placeholder="NAME" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-4 sm:px-6 py-4 sm:py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
                   </div>
                   <div className="flex flex-col gap-2">
                     <input required name="contact" type="text" placeholder="CONTACT" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-4 sm:px-6 py-4 sm:py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
                   </div>
                   <div className="flex flex-col gap-2 sm:col-span-2 md:col-span-1">
                     <input required name="email" type="email" placeholder="EMAIL" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-4 sm:px-6 py-4 sm:py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
                   </div>
                 </div>
                 <div className="flex flex-col gap-2 relative">
                   <select required name="subject" defaultValue="" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-4 sm:px-6 py-4 sm:py-5 focus:outline-none focus:border-[#B6916D] transition-colors appearance-none cursor-pointer">
                     <option value="" disabled>SUBJECT</option>
                     <option value="Membership Inquiry">Membership Inquiry</option>
                     <option value="Job Inquiry">Job Inquiry</option>
                   </select>
                   <ChevronDown className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 text-white/50 w-5 h-5 pointer-events-none" />
                 </div>
                 <div className="flex flex-col gap-2">
                   <input required name="city" type="text" placeholder="CITY" className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-4 sm:px-6 py-4 sm:py-5 focus:outline-none focus:border-[#B6916D] transition-colors" />
                 </div>
                 <div className="flex flex-col gap-2 relative">
                   <textarea required name="message" placeholder="TYPE YOUR MESSAGE HERE" rows={4} className="w-full bg-[#131313] border border-white/10 text-white font-headline tracking-widest text-xs px-4 sm:px-6 py-4 sm:py-5 focus:outline-none focus:border-[#B6916D] transition-colors resize-none"></textarea>
                   <div className="absolute bottom-4 right-4 pointer-events-none opacity-50">
                       <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M11 1L1 11M11 5L5 11M11 9L9 11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                       </svg>
                   </div>
                 </div>
                 <div className="flex justify-end">
                   <button type="submit" className="bg-transparent border border-[#B6916D] text-[#B6916D] px-8 sm:px-12 py-3 sm:py-4 font-headline font-bold text-xs tracking-widest uppercase hover:bg-[#B6916D] hover:text-white transition-all">
                     SUBMIT
                   </button>
                 </div>
               </form>
             </FadeIn>
          </div>
        </div>
      </section>

      {/* Categories Section (Image Mosaic) */}
      <section id="gallery" className="flex flex-col sm:flex-row w-full h-auto sm:h-[400px] md:h-[530px]">
          <FadeIn delay={0} className="flex-1 relative overflow-hidden group h-[250px] sm:h-full w-full">
            <Image 
              className="absolute inset-0 w-full h-full object-cover grayscale contrast-125 transition-transform duration-700 group-hover:scale-105" 
              alt="progression" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA89zcVeziI_g42GaPLinsdlQMsKYkEzX75BvjRZnUjbkJCV0_wuoAgiKRwefLG9oHFwzPHOiIUAUUa-lATBltET1wXPYJwu7D9dX5-EvEbbHBBG1RtOrB3i12pSBKd6G3wE-HEz6U1Tprp_wXyMIBLTL90_Cus45IPGO3PK3mTriZ-lcFef36WcNsBYqBRnuKIGKJ-6FRwTQ_9NLeME_CzDUrjV9ZVMDSpCmJXs_dK7fYnpAOvZ0v_QStfMLmmCyggSUX9wnaXE8o"
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-[#a28b5c]/40 transition-colors duration-300"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <h3 className="font-headline font-black text-xl sm:text-2xl md:text-4xl uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white">PROGRESSION</h3>
            </div>
          </FadeIn>
          <FadeIn delay={100} className="flex-1 relative overflow-hidden group h-[250px] sm:h-full w-full">
            <Image 
              className="absolute inset-0 w-full h-full object-cover grayscale contrast-125 transition-transform duration-700 group-hover:scale-105" 
              alt="workout" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDatcwpkKtK3AHe7_UTXPfVdroJujzJPBZLM1Oc0c0hHSr_iG8vxRWba9oaMDZErd4v7G3ZpPLN-s9Sw41gnNarJwgpxAos01cw70xXwwEysErUJl7Y85P4JReTpqv3s2wOAqdfO7bTOX4zufNfNKEjnGQL8fLSVYvrchWSXt_u5qcTTk8CTK_dr4dEtIVL1ggzGJFKxT6U6yaKFJ6Mxj4bMTX5buBib4xhHWDhGEIp4EJRRfMLj6saTSCrabkJpnf86pquUYi_ei4"
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-[#a28b5c]/40 transition-colors duration-300"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <h3 className="font-headline font-black text-xl sm:text-2xl md:text-4xl uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white">WORKOUT</h3>
            </div>
          </FadeIn>
          <FadeIn delay={200} className="flex-1 relative overflow-hidden group h-[250px] sm:h-full w-full">
            <Image 
              className="absolute inset-0 w-full h-full object-cover grayscale contrast-125 transition-transform duration-700 group-hover:scale-105" 
              alt="nutrition" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBBkV0JBHVmvH7hLDpTBQKuPKjKCaziSIY7oAJoxLCZsU1u-EiyJ_uKf_0pctUVZjTTxwC9qpmuC0oUWTDxf80AXXEOn0-HtmG0WxMoLZSSDeEPBwSdXbHAFU-zejb7NTY2x01pOtnlhBz_-o7JTys1kv4cvTrubqVqhzMrfh8fnGMlMrB-32v0PDQhaULG8TSSmoGndmKPlBwfHiBNuEYYdaXfKxlv_6O_q4pW_-jduylPcHyy2NTaqSGFhVxN9r_JH5oWLq3StSo"
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
            />
            <div className="absolute inset-0 bg-black/40 group-hover:bg-[#a28b5c]/40 transition-colors duration-300"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <h3 className="font-headline font-black text-xl sm:text-2xl md:text-4xl uppercase tracking-[0.15em] sm:tracking-[0.2em] text-white">NUTRITIONS</h3>
            </div>
          </FadeIn>
      </section>

      {/* Footer CTA */}
      <section className="relative h-[300px] sm:h-[400px] md:h-[530px] flex items-center justify-center overflow-hidden">
        <Image 
          className="absolute inset-0 w-full h-full object-cover grayscale brightness-[0.3]" 
          alt="footer background" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDr3E2FUEjNjj5n5rz1oor8L5QY8I4JS5NFV_fqvMC1ojDTDfJaZpjdqkWsZBwMFN6XAv07N8co-pxTGRRGYCaZEZkIi-xHXiYUqFIiMcNfwxpZDnia3xi848hgxvw5RpubtJRPeSeCbYdE3ijUudHPAPj61-79PM3BfL6yIjD1cRA71k_2NVAE7XfRFv7GyylbTDds0ITTozbm67G04SlXs1-u57Zi1WCiZzO5q4-_MmgbxmyekkGIMYaW3SQlexDxFCgQFXZXxNo"
          fill
          sizes="100vw"
        />
        <div className="relative z-10 text-center px-4 sm:px-6">
          <FadeIn>
            <h2 className="font-headline font-black text-2xl sm:text-3xl md:text-5xl uppercase tracking-tighter mb-6 sm:mb-8 md:mb-10 leading-none text-white">
              START YOUR FITNESS JOURNEY<br/>WITH US TODAY
            </h2>
            <Link href="/trial?gym=vyom-gym-club-qf7mj8">
              <button className="bg-[#B6916D] text-white px-8 sm:px-12 py-4 sm:py-5 font-headline text-xs sm:text-sm font-black tracking-widest uppercase hover:bg-white hover:text-[#B6916D] transition-all">
                GET STARTED NOW
              </button>
            </Link>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
