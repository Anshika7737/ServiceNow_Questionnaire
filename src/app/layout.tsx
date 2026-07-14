import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { KeyboardFocusProvider } from "@/components/keyboard-focus-provider";
import { displayTrackName, formatTrackList } from "@/lib/categories";
import { listExamCategories } from "@/lib/exams";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const categories = await listExamCategories();
  const trackList = formatTrackList(categories.map((c) => displayTrackName(c.label)));

  return {
    title: "CertPrep - ServiceNow Certification Practice",
    description: `Practice ${trackList} exams with role-based team management.`,
  };
}

const themeScript = `
  (function () {
    try {
      var stored = localStorage.getItem('certprep-theme');
      var dark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (dark) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <KeyboardFocusProvider>{children}</KeyboardFocusProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
