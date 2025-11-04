import { list } from '@vercel/blob'
import { NextResponse } from 'next/server'

const BLOB_PATH = 'latest.json'
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN

export async function GET() {
  try {
    const { blobs } = await list({
      token: BLOB_TOKEN
    })

    const blob = blobs.find((b) => b.pathname === BLOB_PATH)

    if (!blob) {
      return NextResponse.json(
        { items: [], lastUpdated: null },
        { status: 200 }
      )
    }

    const res = await fetch(blob.url)

    if (!res.ok) {
      throw new Error('Failed to fetch blob data')
    }

    const data = await res.json()
    return NextResponse.json(data, { status: 200 })
  } catch (error: any) {
    console.error('[API] Fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
