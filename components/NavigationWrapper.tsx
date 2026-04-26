"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
// import { Footer } from "@/components/Footer";
import { ReactNode } from "react";

export function NavigationWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  
  // Hide Navbar and Footer on internal admin routes and specific public forms
  const hideNavigation = 
    pathname.startsWith("/admin/dashboard") || 
    pathname.startsWith("/admin/analytics") || 
    pathname.startsWith("/admin/members") || 
    pathname.startsWith("/admin/member") || 
    pathname.startsWith("/admin/settings") ||
    pathname.startsWith("/admin/login") ||
    pathname.startsWith("/admin/onboarding") ||
    pathname.startsWith("/admin/pending") ||
    pathname.startsWith("/developer/login") ||
    pathname.startsWith("/trainer/login") ||
    pathname.startsWith("/front-desk/login") ||
    pathname.startsWith("/admin/staff") ||
    pathname.startsWith("/admin/archives") ||
    pathname.startsWith("/admin/invoices") ||
    pathname.startsWith("/admin/invoice") ||
    pathname.startsWith("/admin/inquiries") ||
    pathname.startsWith("/admin/inquiry") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/trial");

  return (
    <>
      {!hideNavigation && <Navbar />}
      <main className="flex-1 w-full flex flex-col">
        {children}
      </main>
      {/* {!hideNavigation && <Footer />} */}
    </>
  );
}
