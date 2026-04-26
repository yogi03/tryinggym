"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Menu,
  BarChart3,
  Contact,
  Archive,
  MoreVertical,
  Settings as SettingsIcon,
  FileText
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

const menuItems = [
  { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Members", href: "/admin/members", icon: Users },
  { name: "Inquiries", href: "/admin/inquiries", icon: Contact },
  { name: "Trainers & Staff", href: "/admin/staff", icon: Contact },
  { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { name: "Invoices", href: "/admin/invoices", icon: FileText },
  { name: "Archive", href: "/admin/archives", icon: Archive },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, adminData, frontDeskData, isDeveloper, isFrontDesk, availableGyms, activeGymId, setActiveGymId, activeGym } = useAuth();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const handleGymChange = (gymId: string) => {
    if (!gymId || gymId === activeGymId) return;
    setActiveGymId(gymId);
    window.location.assign(pathname || "/admin/dashboard");
  };

  const SidebarContent = () => {
    const accountEmail = adminData?.email || frontDeskData?.email || "";
    const initials = accountEmail ? accountEmail[0].toUpperCase() : "A";
    const visibleMenuItems = isFrontDesk
      ? menuItems.filter((item) => ["/admin/dashboard", "/admin/inquiries", "/admin/archives"].includes(item.href))
      : menuItems;
    
    return (
      <div className="flex flex-col h-full bg-[#0F0F1A] text-white">
        <div className="p-6 flex items-center justify-center border-b border-white/[0.08]">
          <Link href="/admin/dashboard" className="h-10 relative w-full aspect-[4/1]">
            <Image
              src={activeGym?.logoUrl || "/gymmanagr-logo.png"}
              alt={activeGym?.name || "GymManagr"}
              fill
              className="object-contain object-left"
              priority
            />
          </Link>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {visibleMenuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                pathname === item.href 
                  ? "bg-[#B6916D] text-white shadow-lg shadow-[#B6916D]/20" 
                  : "text-[#8888A0] hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
          {!isFrontDesk && (
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                pathname === "/admin/settings"
                  ? "bg-[#B6916D] text-white shadow-lg shadow-[#B6916D]/20"
                  : "text-[#8888A0] hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </Link>
          )}
        </nav>

        {/* Profile Section */}
        <div className="p-4 border-t border-white/[0.08]">
          <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors group relative cursor-pointer">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6F51FF] via-[#00D1FF] to-[#00F0FF] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-[#00D1FF]/20 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-white transition-colors">
                {accountEmail.split('@')[0] || "Admin"}
              </p>
              <p className="text-[10px] text-[#8888A0] font-medium uppercase tracking-wider">
                {isDeveloper ? "Developer Access" : frontDeskData ? "Front Desk" : "Gym Administrator"}
              </p>
            </div>
            <div className="flex flex-col gap-1 items-center justify-center group/menu relative">
              <button 
                onClick={handleLogout}
                className="p-1 rounded-md text-[#8888A0] hover:text-white hover:bg-white/[0.08] transition-all"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {isDeveloper && (
          <div className="px-4 pb-4 border-t border-white/[0.08]">
            <div className="pt-4 space-y-2">
              <p className="text-[10px] text-[#8888A0] font-medium uppercase tracking-wider">Viewing Gym</p>
              <select
                value={activeGymId || ""}
                onChange={(event) => handleGymChange(event.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-white"
              >
                {availableGyms.map((gym) => (
                  <option key={gym.gymId} value={gym.gymId}>
                    {gym.name} ({gym.gymId})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Menu Trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={
              <Button variant="ghost" size="icon" className="lg:hidden fixed top-4 left-4 z-50 bg-background/80 backdrop-blur shadow-sm border border-border/50" />
            }>
                <Menu className="h-6 w-6" />
            </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 border-r bg-muted/50 flex-col h-screen sticky top-0 shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
}
