import { redirect } from "next/navigation";

/** The proxy normally handles "/" but this is a safe fallback. */
export default function Home() {
  redirect("/dashboard");
}
