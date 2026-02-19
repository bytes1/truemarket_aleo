// app/page.tsx
import { redirect } from "next/navigation";

export default function RootPage() {
  redirect("/market");
  
  // This return is never reached, but required for TS
  return null;
}