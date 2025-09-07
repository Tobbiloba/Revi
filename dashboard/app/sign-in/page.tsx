"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
function SignInContent() {
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  return (
    <div className="flex flex-col justify-center items-center w-fit h-fit py-4" style={{
      width: '506px',
      borderRadius: '20px',
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(60px) saturate(180%)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: 'rgba(0, 0, 0, 0.3) 0px 8px 32px, rgba(0, 0, 0, 0.2) 0px 2px 16px, rgba(255, 255, 255, 0.2) 0px 1px 0px inset, rgba(255, 255, 255, 0.05) 0px -1px 0px inset',
      // padding: '20px',
      position: 'relative',
      overflow: 'hidden',
      cursor: 'text'
    }}>
      <Card
        className="w-full bg-transparent border-0 shadow-none text-white"

      >
        <CardHeader>
          <CardTitle className="text-lg md:text-3xl font-[500] mx-auto">
            Sign in to continue
          </CardTitle>
          <CardDescription className="text-xs md:text-sm mx-auto text-white">
            Sign in with Google to access your error monitoring dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div
              className={cn(
                "w-full gap-2 flex items-center",
                "justify-between flex-col",
              )}
            >
              <Button
                variant="outline"
                className={cn("w-full gap-2 bg-white/20 border-none text-white h-12 hover:bg-neutral-950")}
                disabled={loading}
                onClick={async () => {
                  try {
                    await authClient.signIn.social(
                      {
                        provider: "google",
                        callbackURL: returnTo || "/dashboard",
                      },
                      {
                        onRequest: () => {
                          setLoading(true);
                        },
                        onResponse: () => {
                          setLoading(false);
                        },
                        onError: (ctx) => {
                          setLoading(false);
                          // Add user-friendly error handling here
                          console.error("Sign-in failed:", ctx.error);
                        },
                      },
                    );
                  } catch (error) {
                    setLoading(false);
                    console.error("Authentication error:", error);
                    // Consider adding toast notification for user feedback
                    toast.error("Oops, something went wrong", {
                      duration: 5000,
                    });
                  }
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="0.98em"
                  height="1em"
                  viewBox="0 0 256 262"
                >
                  <path
                    fill="#4285F4"
                    d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                  ></path>
                  <path
                    fill="#34A853"
                    d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                  ></path>
                  <path
                    fill="#FBBC05"
                    d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                  ></path>
                  <path
                    fill="#EB4335"
                    d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                  ></path>
                </svg>
                Login with Google
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <p className="mt-2 mb-6 text-xs text-center text-white max-w-md">
        By signing in, you agree to our{" "}
        <Link
          href="/terms-of-service"
          className="underline text-purple-200 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="/privacy-policy"
          className="underline text-purple-200 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Privacy Policy
        </Link>
      </p>
    </div >
  );
}

export default function SignIn() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col justify-center items-center w-full h-screen">
          {/* <div className="max-w-md w-full bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg h-96"></div> */}
        </div>
      }
    >
      <div className="flex flex-row w-full h-screen">
        <div className="w-7/12 h-screen bg-black flex flex-col justify-center items-center text-white">
          <div className="flex  bottom-18 relative">
            <Image
            src="/logo-white.png"
            alt="Sign In Background"
            width={170}
            height={170}
            className=""
          />
          <h1 className="text-[6rem] font-[600]">Revi</h1>
          </div>
          <p className="max-w-2xl text-center text-lg relative bottom-10 bg-gradient-to-r from-blue-100 via-gray-500 to-slate-300 bg-clip-text text-transparent mb-12 leading-relaxed">Open-source error monitoring and session replay that captures frontend errors and user interactions. See exactly what users experienced when errors occurred with complete session playback.</p>
        </div>
        <div className="w-5/12 h-screen flex items-center justify-center bg-[#1A1D20]">
          <SignInContent />
        </div>
      </div>
    </Suspense>
  );
}
