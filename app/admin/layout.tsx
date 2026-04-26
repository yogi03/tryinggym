"use client";

import { ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/onboarding"];
const FRONT_DESK_BLOCKED_PATHS = [
  "/admin/members",
  "/admin/staff",
  "/admin/analytics",
  "/admin/invoices",
  "/admin/settings",
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const { loading, adminData, trainerData, frontDeskData, isTrainer, isFrontDesk, activeGym } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(path))) {
      if (adminData) {
        router.replace("/admin/dashboard");
      } else if (isFrontDesk && frontDeskData?.staffId) {
        router.replace("/admin/dashboard");
      } else if (isTrainer && trainerData?.staffId) {
        router.replace(`/admin/staff/${trainerData.staffId}`);
      }
      return;
    }

    if (isTrainer && trainerData?.staffId) {
      const trainerPath = `/admin/staff/${trainerData.staffId}`;
      if (pathname !== trainerPath) {
        router.replace(trainerPath);
      }
      return;
    }

    if (isFrontDesk) {
      const isBlockedFrontDeskRoute = FRONT_DESK_BLOCKED_PATHS.some((path) => {
        // Allow detail pages but block list pages for members and staff
        if (path === "/admin/members" || path === "/admin/staff") {
          return pathname === path;
        }
        // Block other sections entirely (analytics, invoices, settings)
        return pathname === path || pathname.startsWith(`${path}/`);
      });

      if (isBlockedFrontDeskRoute) {
        router.replace("/admin/dashboard");
      }
      return;
    }

    if (!adminData && !isFrontDesk) {
      router.replace("/admin/login");
      return;
    }

    // Check for Gym Approval
    if (adminData && activeGym && activeGym.onboardingStatus === "pending") {
      if (pathname !== "/admin/pending") {
        router.replace("/admin/pending");
      }
      return;
    }

    // If on /admin/pending but gym is already approved, go to dashboard
    if (adminData && activeGym && activeGym.onboardingStatus === "approved" && pathname === "/admin/pending") {
      router.replace("/admin/dashboard");
    }
  }, [loading, pathname, router, adminData, isFrontDesk, frontDeskData, isTrainer, trainerData, activeGym]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
      </div>
    );
  }

  if (PUBLIC_ADMIN_PATHS.some((path) => pathname.startsWith(path))) {
    return <>{children}</>;
  }

  if (isTrainer && trainerData?.staffId) {
    return pathname === `/admin/staff/${trainerData.staffId}` ? <>{children}</> : null;
  }

  return adminData || isFrontDesk ? <>{children}</> : null;
}
