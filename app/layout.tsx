import type { Metadata } from "next";
import { Space_Grotesk, Poppins, Epilogue, Manrope } from "next/font/google";
import "./globals.css";
import { NavigationWrapper } from "@/components/NavigationWrapper";
import { AuthProvider } from "@/lib/auth/auth-context";
import { Toaster } from "@/components/ui/toaster";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-grotesk",
});

const epilogue = Epilogue({ subsets: ['latin'], variable: '--font-headline', weight: ['700', '800', '900'] });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] });

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Vyom Gym & Club",
  description: "Vyom Gym & Club is a premium fitness facility located in Rohini Sector 16. We offer state-of-the-art equipment, expert coaching, and a supportive community to help you achieve your fitness goals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${spaceGrotesk.variable} ${poppins.variable} ${epilogue.variable} ${manrope.variable} font-body antialiased bg-[#0e0e0e] text-[#ffffff] selection:bg-[#B6916D] selection:text-[#ffffff] min-h-screen flex flex-col`}>
        <AuthProvider>
          <NavigationWrapper>
            {children}
          </NavigationWrapper>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
