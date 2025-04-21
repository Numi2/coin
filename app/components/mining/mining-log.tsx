"use client"

import { useRef, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface MiningLogProps {
  logs: { time: string; component: string; message: string; type: string }[]
}

export default function MiningLog({ logs }: MiningLogProps) {
  const logEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  // Export logs to file
  const exportLogs = () => {
    const logText = logs.map((log) => `[${log.time}] [${log.component}] ${log.message}`).join("\n")

    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mining-logs-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">Mining Logs</CardTitle>
        <Button variant="outline" size="sm" onClick={exportLogs}>
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </CardHeader>
      <CardContent>
        <div className="bg-black/90 rounded-md p-3 h-[400px] overflow-y-auto text-xs font-mono">
          {logs.length === 0 ? (
            <div className="text-gray-400 text-center py-4">No logs available</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="mb-1">
                <span className="text-gray-400">[{log.time}]</span>{" "}
                <span className="text-purple-400">[{log.component}]</span>{" "}
                <span
                  className={cn(
                    log.type === "success"
                      ? "text-green-400"
                      : log.type === "error"
                        ? "text-red-400"
                        : log.type === "warning"
                          ? "text-yellow-400"
                          : "text-blue-400",
                  )}
                >
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </CardContent>
    </Card>
  )
}
