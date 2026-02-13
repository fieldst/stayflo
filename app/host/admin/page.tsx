import { redirect } from "next/navigation";

export default function HostAdminRedirect() {
  redirect("/host");
}
