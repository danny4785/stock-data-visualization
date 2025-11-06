import { NextResponse } from 'next/server'

const GAGGLE_API_KEY = process.env.GAGGLE_API_KEY!
const GAGGLE_GROUP_EMAIL = process.env.GAGGLE_GROUP_EMAIL!

const SPLIT_CHAR = '<br/>'
const SYMBOL_PREFIX = '@ES'

const headers = {
  'x-api-key': GAGGLE_API_KEY!,
  Accept: 'application/json'
}

async function fetchLatestMessage() {
  const res = await fetch(
    `https://api.gaggle.email/api/v3/group/${GAGGLE_GROUP_EMAIL}/messages?limit=1`,
    { headers }
  )

  if (!res.ok) {
    if (res.status === 417) {
      throw new Error('Gaggle API rate limit exceeded')
    }
    throw new Error('Gaggle API failed')
  }

  const json = await res.json()
  return json?.[0]
}

async function fetchLatestMessageBody(messageId: string) {
  const res = await fetch(
    `https://api.gaggle.email/api/v3/group/${GAGGLE_GROUP_EMAIL}/message/${messageId}`,
    { headers }
  )

  if (!res.ok) {
    if (res.status === 417) {
      throw new Error('Gaggle API rate limit exceeded')
    }
    throw new Error('Gaggle API failed')
  }

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
    const message = await fetchLatestMessage()
    const messageId = message?.messageId
    const sent = message?.sent

    const messageBody = await fetchLatestMessageBody(messageId)

    const items = parseEmailBody(messageBody)
    const data = {
      messageId,
      items,
      sent,
      lastUpdated: Date.now()
    }

    return NextResponse.json(data, { status: 200 })
  } catch (error: any) {
    console.error('[Gaggle Direct API] Error:', error)
    return NextResponse.json(
      {
        error: error.message,
        items: [],
        lastUpdated: null,
        messageId: null,
        sent: null
      },
      { status: 500 }
    )
  }
}
