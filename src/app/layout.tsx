import type { Metadata } from "next";
import "./globals.css";
import WorkspaceFrame from "@/components/workspace-frame";
export const metadata: Metadata = { title: "JOKAI", description: "JOKAI — your connected business workspace" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
 return <html lang="en"><body><WorkspaceFrame>{children}</WorkspaceFrame></body></html>;
}
