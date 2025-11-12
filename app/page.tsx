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
  ComposedChart,
} from "recharts";

const DIRECT_API_CALL = true;

interface MatrixItem {
  symbol: string;
  timeframe: string;
  price: number;
  count: number;
  levels: number[];
}
interface MessageItem {
  sent: string;
  price: number;
  count: number;
  levels: number[];
  messageId: string;
}

interface SymbolTimeframeData {
  symbol: string;
  timeframe: string;
  items: MessageItem[];
}

interface ApiResponse {
  items: Array<MatrixItem>;
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

function generateRawMatrix(items: Array<MatrixItem>) {
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
  const [latestMessageData, setLatestMessageData] = useState<Array<MatrixItem>>(
    []
  );
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
                  count: item.count,
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

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [latestMessageData]);

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
            Real-time market data • Auto-refresh every 5s
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
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">Loading data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-16 bg-gray-800/30 rounded-lg border border-gray-700">
            <p className="text-gray-400">
              Copy and Paste into Conversation with ESTrendBoxAI:
            </p>
          </div>
        ) : (
          <>
            {/* Raw Data - Latest Email Only */}
            <div className="mt-5 mb-5 pt-6 border-t border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-300">
                  Please copy and paste this data in the{" "}
                  <a
                    href="https://chatgpt.com/g/g-68e3f5a7f8588191b7a5e48a4965b65f-estrendboxai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline"
                  >
                    ESTrendBoxAI
                  </a>{" "}
                  conversation:
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
                ref={textareaRef}
                readOnly
                value={generateRawMatrix(latestMessageData)}
                className="w-full min-h-20 bg-gray-800 text-gray-300 p-4 rounded border border-gray-700 font-mono text-xs resize-none overflow-hidden"
              />
            </div>

            {/* Single Legend for all charts */}
            <div className="mb-6 flex justify-center">
              <div className="flex gap-6 flex-wrap justify-center p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-green-500"></div>
                  <span className="text-sm text-gray-300">Bull Box Upper</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-green-500"></div>
                  <span className="text-sm text-gray-300">Bull Box Lower</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-red-600"></div>
                  <span className="text-sm text-gray-300">Bear Box Upper</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-red-600"></div>
                  <span className="text-sm text-gray-300">Bear Box Lower</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 mb-10">
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
                    count: item.count,
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
                const maxValue = Math.max(...allValues);
                const dataRange = maxValue - minValue;
                const padding = dataRange / 8;
                const yAxisMin = minValue - padding;
                const yAxisMax = maxValue + padding;

                return (
                  <div
                    key={`${row.symbol}-${row.timeframe}-${i}`}
                    className="border border-gray-700 rounded-lg overflow-hidden bg-gray-800/20 hover:bg-gray-800/40 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-4 p-4 items-center border-b border-gray-700">
                      <div className="col-span-6">
                        <span className="font-bold text-cyan-300 text-sm">
                          {row.symbol}
                        </span>
                      </div>
                      <div className="col-span-6 flex justify-end">
                        <span className="text-gray-300 text-sm">
                          {row.timeframe}
                        </span>
                      </div>
                    </div>

                    <div className="bg-gray-900/40 pt-4 pb-2">
                      <ResponsiveContainer width="100%" height={420}>
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 0, right: 20, left: 0, bottom: 8 }}
                          style={{ minHeight: 220 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#374151"
                          />
                          <XAxis
                            dataKey="sent"
                            tick={{ fill: "#f31212ff", fontSize: 10 }}
                            height={40}
                            orientation="bottom"
                            xAxisId="date"
                          />
                          {/* <XAxis
                            dataKey="count"
                            tick={{ fill: "#9CA3AF", fontSize: 10 }}
                            height={40}
                            orientation="bottom"
                            tickFormatter={(value) => value.toFixed(0)}
                            xAxisId="count"
                          /> */}
                          <YAxis
                            tick={{ fill: "#9CA3AF", fontSize: 10 }}
                            width={60}
                            tickFormatter={(value) => value.toFixed(0)}
                            domain={[yAxisMin, yAxisMax]}
                          />
                          <Tooltip
                            allowEscapeViewBox={{ x: true, y: true }}
                            content={({
                              active,
                              payload,
                              label,
                            }: {
                              active?: boolean;
                              payload?: Array<{
                                dataKey?: string;
                                value?: number | string;
                                color?: string;
                                payload?: any;
                              }>;
                              label?: string | number;
                            }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                const labelMap: Record<string, string> = {
                                  bullboxupper: "Bull Box Upper",
                                  bullboxlower: "Bull Box Lower",
                                  bearboxupper: "Bear Box Upper",
                                  bearboxlower: "Bear Box Lower",
                                  price: "Price",
                                  count: "Count",
                                };
                                return (
                                  <div
                                    style={{
                                      backgroundColor: "#1F2937",
                                      border: "1px solid #4B5563",
                                      borderRadius: "6px",
                                      padding: "8px",
                                      fontSize: "12px",
                                    }}
                                  >
                                    <p
                                      style={{
                                        color: "#E5E7EB",
                                        fontSize: "8px",
                                        marginBottom: "4px",
                                      }}
                                    >
                                      {label}
                                    </p>
                                    <div style={{ marginTop: "4px" }}>
                                      <p
                                        style={{
                                          color: "#22D3EE",
                                          margin: "2px 0",
                                        }}
                                      >
                                        Price: {data.price?.toFixed(2) || "N/A"}
                                      </p>
                                      {payload.map((entry, index) => {
                                        if (
                                          entry.dataKey === "count" ||
                                          entry.dataKey === "price"
                                        ) {
                                          return null;
                                        }
                                        return (
                                          <p
                                            key={index}
                                            style={{
                                              color: entry.color || "#E5E7EB",
                                              margin: "2px 0",
                                            }}
                                          >
                                            {labelMap[
                                              entry.dataKey as string
                                            ] || entry.dataKey}
                                            :{" "}
                                            {typeof entry.value === "number"
                                              ? entry.value.toFixed(2)
                                              : entry.value}
                                          </p>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />

                          <Line
                            type="monotone"
                            dataKey="bullboxupper"
                            stroke="#16A34A"
                            strokeWidth={2}
                            dot={false}
                            name="Bull Box Upper"
                          />
                          <Line
                            type="monotone"
                            dataKey="bullboxlower"
                            stroke="#16A34A"
                            strokeWidth={2}
                            dot={false}
                            name="Bull Box Lower"
                          />
                          <Line
                            type="monotone"
                            dataKey="bearboxupper"
                            stroke="#DC2626"
                            strokeWidth={2}
                            dot={false}
                            name="Bear Box Upper"
                          />
                          <Line
                            type="monotone"
                            dataKey="bearboxlower"
                            stroke="#DC2626"
                            strokeWidth={2}
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
                                    key={index}
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
            {/* Display the Table */}
            <div className="overflow-x-auto mb-8 rounded-lg border border-gray-700 max-w-5xl m-auto">
              <table className="w-full text-sm margin-auto">
                <thead>
                  <tr className="bg-gray-800 border-b border-gray-700">
                    <th className="px-3 py-2 text-left font-semibold text-cyan-400 w-12">
                      Symbol
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-cyan-400 w-16">
                      Timeframe
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-cyan-400 w-20">
                      Price
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-cyan-400 w-20">
                      UltraCounting
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-cyan-400 flex-1">
                      Levels
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latestMessageData.map((row: any, i: number) => (
                    <tr
                      key={i}
                      className="border-b border-gray-700 hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-bold text-cyan-300">
                        {row.symbol}
                      </td>
                      <td className="px-3 py-2 text-gray-300 text-xs">
                        {row.timeframe}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-white">
                        {row.price.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={`inline-block font-bold px-2 py-1 rounded text-xs ${
                            row.count < 0
                              ? "bg-red-600 text-red-100"
                              : "bg-green-600 text-green-100"
                          }`}
                        >
                          {row.count > 0 ? "↑" : "↓"}{" "}
                          {Math.abs(row.count).toFixed(0)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-2 justify-end">
                          {row.levels.map((lvl: number, j: number) => (
                            <span
                              key={j}
                              className="text-gray-300 text-xs px-2 py-1 bg-gray-700/50 rounded"
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
          </>
        )}
      </div>
    </div>
  );
}
