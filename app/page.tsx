"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

const DIRECT_API_CALL = true 

interface MatrixRow {
  symbol: string
  timeframe: string
  price: number
  count: number
  levels: number[]
}

function formatTime(dateString: string | null) {
  if (!dateString) return "N/A"
  try {
    const date = new Date(dateString)
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })
  } catch {
    return "Invalid date"
  }
}

function generateRawMatrix(items: MatrixRow[]) {
  return items
    .map(
      (row) =>
        `${row.symbol} ${row.timeframe} ${row.price.toFixed(2)} ${row.count.toFixed(2)} ${row.levels.map((l) => l.toFixed(2)).join(" ")}`,
    )
    .join("\n")
}

export default function Home() {
  const [data, setData] = useState<{ items: MatrixRow[]; lastUpdated: string | null }>({ items: [], lastUpdated: null })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiEndpoint = DIRECT_API_CALL ? '/api/gaggle-direct' : '/api/data'
        const res = await fetch(apiEndpoint)
        if (res.ok) {
          const result = await res.json()
          setData(result)
        }
      } catch (error) {
        console.log("[v0] Fetch error:", error)
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
    <div className="min-h-screen bg-linear-to-br from-gray-950 to-gray-900 text-white p-4 font-mono">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-2 text-cyan-400">Levels Forecast Data Matrix</h1>
          <p className="text-center text-gray-400 text-sm">Real-time market data • Auto-refresh every 30s</p>
        </div>

        {/* Last Updated */}
        <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex items-center justify-between">
          <span className="text-gray-400">Last Updated:</span>
          <span className="text-cyan-300 font-semibold">{formatTime(data.lastUpdated)}</span>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Loading data...</p>
          </div>
        ) : data.items.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-gray-400">Waiting for latest email from TradeStation...</p>
            <p className="text-xs text-gray-500 mt-3">Polling every 2 mins • Display updates every 30s</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-10">
              {data.items.map((row: MatrixRow, i: number) => {
                const chartData = row.levels.map((level, idx) => ({
                  name: `L${idx + 1}`,
                  value: level,
                }))

                return (
                  <div
                    key={i}
                    className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/20 hover:bg-gray-800/40 transition-colors"
                  >
                    {/* Table Row */}
                    <div className="grid grid-cols-12 gap-4 p-4 items-center border-b border-gray-700">
                      <div className="col-span-2">
                        <span className="font-bold text-cyan-300 text-sm">{row.symbol}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-300 text-sm">{row.timeframe}</span>
                      </div>
                      <div className="col-span-3">
                        <span className="font-bold text-lg text-white">{row.price.toFixed(2)}</span>
                      </div>
                      <div className="col-span-5">
                        <div className="flex gap-1.5 flex-wrap">
                          {row.levels.map((lvl: number, j: number) => (
                            <span
                              key={j}
                              className="text-gray-300 text-xs px-2 py-1 bg-gray-700/60 rounded border border-gray-600 whitespace-nowrap"
                            >
                              {lvl.toFixed(2)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Chart Row - Below Each Table Row */}
                    <div className="p-4 bg-gray-900/40">
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 10 }} />
                          <YAxis
                            tick={{ fill: "#9CA3AF", fontSize: 10 }}
                            width={60}
                            tickFormatter={(value) => value.toFixed(0)}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1F2937",
                              border: "1px solid #4B5563",
                              borderRadius: "6px",
                              padding: "8px",
                            }}
                            labelStyle={{ color: "#E5E7EB" }}
                            formatter={(value: number) => [value.toFixed(2), "Price"]}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#22D3EE"
                            dot={{ fill: "#22D3EE", r: 3 }}
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Raw Data */}
            <div className="mt-10 pt-6 border-t border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-300">Raw Data Matrix</h2>
                <button
                  onClick={copyRawData}
                  className={`px-4 py-2 rounded text-xs font-medium transition-colors ${
                    copied ? "bg-green-600 text-white" : "bg-cyan-600 hover:bg-cyan-700 text-white"
                  }`}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={generateRawMatrix(data.items)}
                className="w-full h-40 bg-gray-800 text-gray-300 p-4 rounded border border-gray-700 font-mono text-xs resize-none"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
