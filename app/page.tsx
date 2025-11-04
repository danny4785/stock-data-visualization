'use client'

import { useEffect, useState } from 'react'

interface MatrixRow {
  symbol: string
  timeframe: string
  price: number
  count: number
  levels: number[]
}

function formatTime(dateString: string | null) {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  } catch {
    return 'Invalid date'
  }
}

function generateRawMatrix(items: MatrixRow[]) {
  return items
    .map(
      (row) =>
        `${row.symbol} ${row.timeframe} ${row.price.toFixed(
          2
        )} ${row.count.toFixed(2)} ${row.levels
          .map((l) => l.toFixed(2))
          .join(' ')}`
    )
    .join('\n')
}

export default function Home() {
  const [data, setData] = useState<{
    items: MatrixRow[]
    lastUpdated: string | null
  }>({ items: [], lastUpdated: null })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data')
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch (error) {
        console.log('[v0] Fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  const copyRawData = async () => {
    const rawText = generateRawMatrix(data.items)
    await navigator.clipboard.writeText(rawText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className='min-h-screen bg-linear-to-br from-gray-950 to-gray-900 text-white p-4 font-mono'>
      <div className='max-w-7xl mx-auto'>
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-center mb-1 text-cyan-400'>
            TradeStation Matrix Live
          </h1>
          <p className='text-center text-gray-500 text-xs'>
            Real-time market data • Auto-refresh every 30s
          </p>
        </div>

        <div className='mb-4 p-3 bg-gray-800 rounded border border-gray-700 flex items-center justify-between text-sm'>
          <span className='text-gray-400'>Last Updated:</span>
          <span className='text-cyan-300 font-semibold'>
            {formatTime(data.lastUpdated)}
          </span>
        </div>

        {loading ? (
          <div className='text-center py-12'>
            <p className='text-gray-400'>Loading data...</p>
          </div>
        ) : data.items.length === 0 ? (
          <div className='text-center py-12'>
            <p className='text-gray-400'>
              Waiting for latest email from TradeStation...
            </p>
            <p className='text-xs text-gray-500 mt-2'>
              Polling every 2 mins • Display updates every 30s
            </p>
          </div>
        ) : (
          <>
            <div className='overflow-x-auto mb-8 rounded-lg border border-gray-700'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-800 border-b border-gray-700'>
                    <th className='px-3 py-2 text-left font-semibold text-cyan-400 w-12'>
                      Symbol
                    </th>
                    <th className='px-3 py-2 text-left font-semibold text-cyan-400 w-16'>
                      Timeframe
                    </th>
                    <th className='px-3 py-2 text-right font-semibold text-cyan-400 w-20'>
                      Price
                    </th>
                    <th className='px-3 py-2 text-center font-semibold text-cyan-400 w-20'>
                      Count
                    </th>
                    <th className='px-3 py-2 text-right font-semibold text-cyan-400 flex-1'>
                      Levels
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row: MatrixRow, i: number) => (
                    <tr
                      key={i}
                      className='border-b border-gray-700 hover:bg-gray-800/50 transition-colors'
                    >
                      <td className='px-3 py-2 font-bold text-cyan-300'>
                        {row.symbol}
                      </td>
                      <td className='px-3 py-2 text-gray-300 text-xs'>
                        {row.timeframe}
                      </td>
                      <td className='px-3 py-2 text-right font-semibold text-white'>
                        {row.price.toFixed(2)}
                      </td>
                      <td className='px-3 py-2 text-center'>
                        <span
                          className={`inline-block font-bold px-2 py-1 rounded text-xs ${
                            row.count < 0
                              ? 'bg-red-600 text-red-100'
                              : 'bg-green-600 text-green-100'
                          }`}
                        >
                          {row.count > 0 ? '↑' : '↓'}{' '}
                          {Math.abs(row.count).toFixed(0)}
                        </span>
                      </td>
                      <td className='px-3 py-2'>
                        <div className='flex gap-2 justify-end'>
                          {row.levels.map((lvl: number, j: number) => (
                            <span
                              key={j}
                              className='text-gray-300 text-xs px-2 py-1 bg-gray-700/50 rounded'
                            >
                              {lvl.toFixed(2)}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className='mt-8 pt-6 border-t border-gray-700'>
              <div className='flex justify-between items-center mb-3'>
                <h2 className='text-sm font-semibold text-gray-300'>
                  Raw Data Matrix
                </h2>
                <button
                  onClick={copyRawData}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                  }`}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <textarea
                readOnly
                value={generateRawMatrix(data.items)}
                className='w-full h-40 bg-gray-800 text-gray-300 p-3 rounded border border-gray-700 font-mono text-xs'
              />
            </div>
          </>
        )}

        <p className='text-center text-xs text-gray-500 mt-8'>
          Data from Vercel Blob • Real-time updates
        </p>
      </div>
    </div>
  )
}
