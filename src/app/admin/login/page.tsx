import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");
  return (
    <div className="grid flex-1 place-items-center px-4 py-12">
      <div className="card w-full max-w-sm p-6">
        <Image src="/images/logo.webp" alt="786 Pizza & Wings" width={400} height={500} className="mx-auto h-24 w-auto" preload />
        <h1 className="h-display mt-4 text-center text-2xl">Staff sign in</h1>
        <LoginForm />
      </div>
    </div>
  );
}
