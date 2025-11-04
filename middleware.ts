import { NextResponse, NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const requiredCode = process.env.AUTH_CODE

  if (!requiredCode) {
    return NextResponse.next()
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (code === requiredCode) {
    return NextResponse.next()
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'content-type': 'text/plain; charset=utf-8' }
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/.*).*)'
  ]
}
