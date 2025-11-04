import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

const GAGGLE_API_KEY = process.env.GAGGLE_API_KEY!
const GAGGLE_GROUP_EMAIL = process.env.GAGGLE_GROUP_EMAIL!

const BLOB_PATH = 'latest.json'
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN!

const SPLIT_CHAR = '<br/>'
const SYMBOL_PREFIX = '@ES'

const headers = {
  'x-api-key': GAGGLE_API_KEY!,
  Accept: 'application/json'
}

async function fetchLatestMessageId() {
  const res = await fetch(
    `https://api.gaggle.email/api/v3/group/${GAGGLE_GROUP_EMAIL}/messages?limit=1`,
    { headers }
  )

  if (!res.ok) throw new Error('Gaggle API failed')

  const json = await res.json()
  return json?.[0]?.messageId
}

async function fetchLatestMessageBody(messageId: string) {
  const res = await fetch(
    `https://api.gaggle.email/api/v3/group/${GAGGLE_GROUP_EMAIL}/message/${messageId}`,
    { headers }
  )

  if (!res.ok) throw new Error('Gaggle API failed')

  const json = await res.json()
  return json?.cleanedBody || []
}

function parseEmailBody(body: string) {
  if (!body) return []

  return body
    .split(SPLIT_CHAR)
    .map((l) => l.trim())
    .filter((l) => l.startsWith(SYMBOL_PREFIX))
    .map((l) => {
      const p = l.split(/\s+/)
      if (p.length < 8) return null

      let symbol, timeframe, price, count, levels

      if (p[2] === 'Min') {
        symbol = p[0]
        timeframe = `${p[1]} ${p[2]}`
        price = parseFloat(p[3].replace(/,/g, ''))
        count = parseFloat(p[4])
        levels = p.slice(5, 9).map((x) => parseFloat(x.replace(/,/g, '')))
      } else {
        symbol = p[0]
        timeframe = p[1]
        price = parseFloat(p[2].replace(/,/g, ''))
        count = parseFloat(p[3])
        levels = p.slice(4, 8).map((x) => parseFloat(x.replace(/,/g, '')))
      }

      if (isNaN(price) || isNaN(count) || levels.some(isNaN)) return null

      return { symbol, timeframe, price, count, levels }
    })
    .filter(Boolean)
}

export async function GET() {
  try {
    const messageId = await fetchLatestMessageId()
    const messageBody = await fetchLatestMessageBody(messageId)

    const items = parseEmailBody(messageBody)
    const data = {
      items,
      lastUpdated: Date.now()
    }

    await put(BLOB_PATH, JSON.stringify(data, null, 2), {
      access: 'public',
      allowOverwrite: true,
      token: BLOB_TOKEN
    })

    return NextResponse.json({ success: true, count: items.length })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
