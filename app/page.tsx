"use client";

import { useEffect, useState, useRef } from "react";
import {
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
} from "recharts";

const DIRECT_API_CALL = true;

interface MessageItem {
  sent: string;
  price: number;
  levels: number[];
  messageId: string;
}

interface SymbolTimeframeData {
  symbol: string;
  timeframe: string;
  items: MessageItem[];
}

interface ApiResponse {
  items: Array<{
    symbol: string;
    timeframe: string;
    price: number;
    count: number;
    levels: number[];
  }>;
  lastUpdated: string | null;
  messageId: string | null;
  sent: string | null;
}

function adjustToUserTimezone(date: Date): Date {
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  const utcTimestamp = date.getTime() - userTimezoneOffset;
  return new Date(utcTimestamp);
}

function formatTime(dateString: string | null) {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid date";
  }
}

function generateRawMatrix(
  items: Array<{
    symbol: string;
    timeframe: string;
    price: number;
    count: number;
    levels: number[];
  }>
) {
  return items
    .map(
      (row) =>
        `${row.symbol} ${row.timeframe} ${row.price.toFixed(
          2
        )} ${row.count.toFixed(2)} ${row.levels
          .map((l) => l.toFixed(2))
          .join(" ")}`
    )
    .join("\n");
}

export default function Home() {
  const [data, setData] = useState<SymbolTimeframeData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [latestMessageData, setLatestMessageData] = useState<
    Array<{
      symbol: string;
      timeframe: string;
      price: number;
      count: number;
      levels: number[];
    }>
  >([]);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [maxMessages, setMaxMessages] = useState<number>(10);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const apiEndpoint = DIRECT_API_CALL
          ? "/api/gaggle-direct"
          : "/api/data";
        const res = await fetch(apiEndpoint);
        if (res.ok) {
          const result: ApiResponse = await res.json();

          setLatestMessageData(result.items);
          setLastUpdated(result.lastUpdated);
          if (
            result.messageId &&
            !seenMessageIdsRef.current.has(result.messageId) &&
            result.sent
          ) {
            seenMessageIdsRef.current.add(result.messageId);

            setData((prevData) => {
              const messageId = result.messageId!;

              const messageIdExists = prevData.some((symbolData) =>
                symbolData.items.some((item) => item.messageId === messageId)
              );

              if (messageIdExists) {
                return prevData;
              }

              const newData = [...prevData];
              result.items.forEach((item) => {
                const existingIndex = newData.findIndex(
                  (d) =>
                    d.symbol === item.symbol && d.timeframe === item.timeframe
                );

                const messageItem: MessageItem = {
                  sent: result.sent!,
                  price: item.price,
                  levels: item.levels,
                  messageId: messageId,
                };

                if (existingIndex >= 0) {
                  const hasDuplicate = newData[existingIndex].items.some(
                    (existingItem) =>
                      existingItem.messageId === messageItem.messageId
                  );

                  if (!hasDuplicate) {
                    newData[existingIndex].items.push(messageItem);

                    if (newData[existingIndex].items.length > maxMessages) {
                      // trim oldest until length is within limit
                      while (
                        newData[existingIndex].items.length > maxMessages
                      ) {
                        newData[existingIndex].items.shift();
                      }
                    }
                  }
                } else {
                  newData.push({
                    symbol: item.symbol,
                    timeframe: item.timeframe,
                    items: [messageItem],
                  });
                }
              });

              return newData;
            });
          }
        }
      } catch (error) {
        console.log("[v0] Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [maxMessages]);

  // When maxMessages changes, trim existing stored data so each symbol/timeframe
  // only keeps the latest `maxMessages` items.
  useEffect(() => {
    setData((prev) =>
      prev.map((d) => ({ ...d, items: d.items.slice(-maxMessages) }))
    );
  }, [maxMessages]);

  const copyRawData = async () => {
    const rawText = generateRawMatrix(latestMessageData);
    await navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-950 to-gray-900 text-white p-2 font-mono">
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-center mb-2 text-cyan-400">
            Levels Forecast Data Matrix
          </h1>
          <p className="text-center text-gray-400 text-sm">
            Real-time market data • Auto-refresh every 30s
          </p>
        </div>

        {/* Last Updated and controls */}
        <div className="mb-8 p-4 bg-gray-800/50 rounded-lg border border-gray-700 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-gray-400">Last Updated:</span>
            <span className="text-cyan-300 font-semibold">
              {formatTime(lastUpdated)}
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <label htmlFor="max-messages" className="text-gray-400 text-sm">
              Max Messages
            </label>
            <select
              id="max-messages"
              value={maxMessages}
              onChange={(e) => setMaxMessages(Number(e.target.value))}
              className="bg-gray-700 text-gray-200 text-sm rounded px-2 py-1 border border-gray-600"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Loading data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-gray-400">
              Waiting for latest email from TradeStation...
            </p>
            <p className="text-xs text-gray-500 mt-3">
              Polling every 2 mins • Display updates every 30s
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10">
              {data.map((row: SymbolTimeframeData, i: number) => {
                const chartData = row.items.map((item) => {
                  const sentDate = new Date(item.sent);
                  const adjustedDate = adjustToUserTimezone(sentDate);
                  const timeLabel = adjustedDate.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  });
                  return {
                    sent: timeLabel,
                    sentFull: item.sent,
                    price: item.price,
                    bullboxupper: item.levels[0] || 0,
                    bullboxlower: item.levels[1] || 0,
                    bearboxupper: item.levels[2] || 0,
                    bearboxlower: item.levels[3] || 0,
                  };
                });

                const allValues = chartData.flatMap((d) => [
                  d.price,
                  d.bullboxupper,
                  d.bullboxlower,
                  d.bearboxupper,
                  d.bearboxlower,
                ]);
                const minValue = Math.min(...allValues);
                const yAxisMin = (minValue * 2) / 3;

                return (
                  <div
                    key={`${row.symbol}-${row.timeframe}-${i}`}
                    className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/20 hover:bg-gray-800/40 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-4 p-4 items-center border-b border-gray-700">
                      <div className="col-span-3">
                        <span className="font-bold text-cyan-300 text-sm">
                          {row.symbol}
                        </span>
                      </div>
                      <div className="col-span-3">
                        <span className="text-gray-300 text-sm">
                          {row.timeframe}
                        </span>
                      </div>
                      <div className="col-span-6">
                        <span className="text-gray-400 text-xs">
                          Messages: {row.items.length}/{maxMessages}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-900/40 pt-4 pb-2">
                      <ResponsiveContainer width="100%" height={400}>
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 20, right: 20, left: 0, bottom: 10 }}
                          style={{ minHeight: 220 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis
                            dataKey="sent"
                            tick={{ fill: "#9CA3AF", fontSize: 10 }}
                            height={40}
                          />
                          <YAxis
                            tick={{ fill: "#9CA3AF", fontSize: 10 }}
                            width={60}
                            tickFormatter={(value) => value.toFixed(0)}
                            domain={["dataMin", "dataMax"]}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#1F2937",
                              border: "1px solid #4B5563",
                              borderRadius: "6px",
                              padding: "8px",
                            }}
                            labelStyle={{ color: "#E5E7EB" }}
                            formatter={(value: number, name: string) => {
                              const labelMap: Record<string, string> = {
                                bullboxupper: "Bull Box Upper",
                                bullboxlower: "Bull Box Lower",
                                bearboxupper: "Bear Box Upper",
                                bearboxlower: "Bear Box Lower",
                                price: "Price",
                              };
                              return [value.toFixed(2), labelMap[name] || name];
                            }}
                          />
                          <Legend
                            wrapperStyle={{
                              paddingTop: "5px",
                              paddingBottom: "5px",
                            }}
                            iconType="line"
                          />

                          {/* Replace Levels with Bull/Bear Lines */}
                          <Line
                            type="monotone"
                            dataKey="bullboxupper"
                            stroke="#16A34A"
                            strokeWidth={2}
                            // dot={{ fill: "#16A34A", r: 4 }}
                            dot={false}
                            name="Bull Box Upper"
                          />
                          <Line
                            type="monotone"
                            dataKey="bullboxlower"
                            stroke="#16A34A"
                            strokeWidth={2}
                            // dot={{ fill: "#4ADE80", r: 4 }}
                            dot={false}
                            name="Bull Box Lower"
                          />
                          <Line
                            type="monotone"
                            dataKey="bearboxupper"
                            stroke="#DC2626"
                            strokeWidth={2}
                            // dot={{ fill: "#DC2626", r: 4 }}
                            dot={false}
                            name="Bear Box Upper"
                          />
                          <Line
                            type="monotone"
                            dataKey="bearboxlower"
                            stroke="#DC2626"
                            strokeWidth={2}
                            // dot={{ fill: "#F87171", r: 4 }}
                            dot={false}
                            name="Bear Box Lower"
                          />

                          {/* Price line */}
                          <Line
                            type="monotone"
                            dataKey="price"
                            stroke="transparent"
                            strokeWidth={0}
                            dot={(props) => {
                              const { cx, cy, index } = props as any;
                              if (index === chartData.length - 1) {
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill="#22D3EE"
                                    stroke="#0891b2"
                                    strokeWidth={1}
                                  />
                                );
                              }
                              return <g />;
                            }}
                            name=""
                            isAnimationActive={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Raw Data - Latest Email Only */}
            <div className="mt-10 pt-6 border-t border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-300">
                  Latest Email Data
                </h2>
                <button
                  onClick={copyRawData}
                  className={`px-4 py-2 rounded text-xs font-medium transition-colors ${
                    copied
                      ? "bg-green-600 text-white"
                      : "bg-cyan-600 hover:bg-cyan-700 text-white"
                  }`}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <textarea
                readOnly
                value={generateRawMatrix(latestMessageData)}
                className="w-full h-40 bg-gray-800 text-gray-300 p-4 rounded border border-gray-700 font-mono text-xs resize-none"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
