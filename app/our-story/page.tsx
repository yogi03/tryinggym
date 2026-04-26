import { FadeIn } from "@/components/FadeIn";
import { Footer } from "@/components/Footer";

export default function OurStoryPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#131313] text-white overflow-hidden">
      <div className="flex-1 w-full flex flex-col pt-32 pb-24 px-6 md:px-12">
        <div className="max-w-screen-xl mx-auto w-full">
          <FadeIn className="space-y-6 text-center mb-20">
            <span className="text-[#B6916D] font-headline font-bold uppercase tracking-widest text-sm">The Platform</span>
            <h1 className="text-white font-headline font-black text-4xl md:text-6xl uppercase tracking-tighter">Our Mission</h1>
            <p className="max-w-2xl mx-auto text-[#ababab] text-base md:text-lg leading-relaxed font-body mt-6">
              We didn't just build a tool. We forged a digital arena for gym owners who refuse to settle for mediocrity.
            </p>
          </FadeIn>

          <div className="flex flex-col md:flex-row gap-16 items-center">
              <div className="w-full md:w-1/2 relative h-[500px]">
                  <img 
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuDltPfFIr4LaxrIAi8HsjdnAP2k9ZnkdA95paGIbLMblBO0nxtnxFISisqiKxGoLdCzYKMtfi80psSfIjMGsfcN8K48o_8iT0g72YYYnXUQkM13XztjFq_W5SMycrjoMgwbM46ZG3uC4ffFc2-d42lSIgDY-LbnI0resQr39QR3Uhgyme4PIGU9XvJ0pvrJsDpDSQvmM3wgP6BZLRKVFNj3XOhcYg-T2iK8w9dVU3cD1n6bGCN1MEcbrcEpkXtGto7Onx5pfnGC_9o" 
                      alt="GymManagr Evolution"
                      className="absolute inset-0 w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
                  />
              </div>
              <div className="w-full md:w-1/2 space-y-8 text-[#ababab] font-body text-sm md:text-base leading-relaxed">
                  <p>
                      GymManagr was established with a singular vision: to create the architectural standard for elite gym operations. Founded by industry veterans who grew tired of fragmented software and manual logs, we sought to bring back the focus on what truly matters—your members' progression. 
                  </p>
                  <p>
                      The name "GymManagr" represents our commitment to precision, efficiency, and scale. We believe that a gym is more than just a place to sweat—it's a business that deserves elite management. Our platform provides the Kinetic Monolith systems to power your growth.
                  </p>
                  <p className="text-white font-headline text-lg tracking-widest uppercase py-4 border-l-4 border-[#B6916D] pl-6 my-8 italic">
                      "We provide the monolithic structure for your fitness empire's evolution."
                  </p>
                  <p>
                      Today, GymManagr stands as the premier partner for serious gym owners and fitness entrepreneurs. We combine state-of-the-art automation, intuitive workflows, and deep analytics to ensure your success.
                  </p>
              </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
