import { redirect } from "next/navigation";

export default function Dashboard() {
  // Central dashboard moved to a dedicated route, but we keep /dashboard working.
  redirect("/central-dashboard");
}
