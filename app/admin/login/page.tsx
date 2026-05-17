import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const admin = await getAdminSession();

  if (admin) {
    redirect("/admin");
  }

  return <LoginForm />;
}
