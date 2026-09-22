import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // /admin is shared by ADMIN and LEAD; only plain MEMBER gets bounced to /member
    if (path.startsWith("/admin") && token?.role === "MEMBER") {
      return NextResponse.redirect(new URL("/member", req.url));
    }
    if (path.startsWith("/member") && token?.role !== "MEMBER") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/member/:path*"],
};
