"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState("HOME");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (pathname.includes("/admin")) {
      setActiveTab("ADMIN");
    } else if (pathname === "/") {
      if (typeof window !== "undefined") {
          if (window.location.hash === "#about") setActiveTab("ABOUT");
          else if (window.location.hash === "#facilities") setActiveTab("FACILITIES");
          else if (window.location.hash === "#gallery") setActiveTab("GALLERY");
          else setActiveTab("HOME");
      }
    } else {
      setActiveTab("");
    }
  }, [pathname]);

  return (
    <nav className="fixed top-0 w-full z-50 transition-all duration-300 pointer-events-none">
      <div className="flex items-stretch justify-between w-full h-16 sm:h-20 lg:h-24 pointer-events-auto shadow-sm">
        {/* Left Side: Logo */}
        <div className="flex items-center pl-4 sm:pl-6 lg:pl-16 w-auto">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
            <Image src="/logo.png" alt="logo" width={100} height={20} priority className="object-contain w-[70px] sm:w-[80px] lg:w-[100px]" />
          </Link>
        </div>
        
        {/* Right Side: Navigation Links in Dark Block + Contact Button (Desktop) */}
        <div className="hidden lg:flex flex-1 justify-end">
          <div className="flex items-center bg-[#131313] h-full pl-8 xl:pl-16 pr-4 xl:pr-8">
            <div className="flex items-center justify-center gap-6 xl:gap-12 font-headline uppercase tracking-widest font-bold text-[10px] xl:text-xs mr-12 xl:mr-36">
              <Link onClick={() => setActiveTab("HOME")} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "HOME" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/">HOME</Link>
              <Link onClick={() => setActiveTab("ABOUT")} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "ABOUT" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/#about">ABOUT</Link>
              <Link onClick={() => setActiveTab("FACILITIES")} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "FACILITIES" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/#facilities">FACILITIES</Link>
              <Link onClick={() => setActiveTab("GALLERY")} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "GALLERY" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/#gallery">GALLERY</Link>
              <Link onClick={() => setActiveTab("ADMIN")} className={`pb-1 border-b-[3px] transition-colors duration-150 flex items-center gap-1 ${activeTab === "ADMIN" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/admin/login">
                ADMIN <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <Link href="/register?gym=vyom-gym-club-qf7mj8" className="h-1/2 flex items-center">
              <button className="h-full bg-[#B6916D] text-white px-6 xl:px-12 font-headline text-xs xl:text-sm font-bold tracking-widest uppercase hover:bg-white hover:text-[#B6916D] transition-colors active:scale-95 duration-150 flex items-center justify-center whitespace-nowrap">
                JOIN NOW
              </button>
            </Link>
          </div>
        </div>

        {/* Mobile menu toggle */}
        <div className="lg:hidden flex items-center pr-4 sm:pr-6 bg-[#131313] px-4 sm:px-6 h-full pointer-events-auto">
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white hover:text-[#B6916D] transition-colors">
            {isMobileMenuOpen ? <X className="w-6 h-6 sm:w-7 sm:h-7" /> : <Menu className="w-6 h-6 sm:w-7 sm:h-7" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <div className={`lg:hidden absolute top-16 sm:top-20 left-0 w-full bg-[#131313] border-t border-white/10 flex-col items-center py-6 sm:py-8 gap-6 sm:gap-8 pointer-events-auto transition-transform duration-300 origin-top ${isMobileMenuOpen ? "flex scale-y-100 opacity-100" : "hidden scale-y-0 opacity-0"}`}>
        <div className="flex flex-col items-center justify-center gap-5 sm:gap-6 font-headline uppercase tracking-widest font-bold text-sm">
          <Link onClick={() => { setActiveTab("HOME"); setIsMobileMenuOpen(false); }} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "HOME" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/">HOME</Link>
          <Link onClick={() => { setActiveTab("ABOUT"); setIsMobileMenuOpen(false); }} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "ABOUT" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/#about">ABOUT</Link>
          <Link onClick={() => { setActiveTab("FACILITIES"); setIsMobileMenuOpen(false); }} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "FACILITIES" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/#facilities">FACILITIES</Link>
          <Link onClick={() => { setActiveTab("GALLERY"); setIsMobileMenuOpen(false); }} className={`pb-1 border-b-[3px] transition-colors duration-150 ${activeTab === "GALLERY" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/#gallery">GALLERY</Link>
          <Link onClick={() => { setActiveTab("ADMIN"); setIsMobileMenuOpen(false); }} className={`pb-1 border-b-[3px] transition-colors duration-150 flex items-center gap-1 ${activeTab === "ADMIN" ? "text-white border-[#B6916D]" : "text-[#888888] border-transparent hover:text-white"}`} href="/admin/login">
            ADMIN <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <Link href="/register?gym=vyom-gym-club-qf7mj8" onClick={() => setIsMobileMenuOpen(false)}>
          <button className="bg-[#B6916D] text-white px-8 sm:px-10 py-3 font-headline text-sm font-bold tracking-widest uppercase hover:bg-white hover:text-[#B6916D] transition-colors active:scale-95 duration-150">
            JOIN NOW
          </button>
        </Link>
      </div>
    </nav>
  );
}
