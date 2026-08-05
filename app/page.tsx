import { getAuthService } from "@/lib/auth/authService"
import { redirect } from "next/navigation"

export default async function Home() {
  const authenticated = await getAuthService().verifySession()

  if (authenticated) {
    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}