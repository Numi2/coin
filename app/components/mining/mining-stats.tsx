"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Activity, Clock, Zap, TrendingUp } from "lucide-react"

interface MiningStatsProps {
  mining: boolean
  hashRate: number
  blocksMined: number
  difficulty: number
}

export default function MiningStats({ mining, hashRate, blocksMined, difficulty }: MiningStatsProps) {
  const [hashRateHistory, setHashRateHistory] = useState<number[]>([])
  const [timeLabels, setTimeLabels] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("performance")

  // Update history when hash rate changes
  useEffect(() => {
    if (mining) {
      const now = new Date()
      const timeLabel = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`

      setHashRateHistory((prev) => {
        const newHistory = [...prev, hashRate]
        if (newHistory.length > 20) {
          return newHistory.slice(-20)
        }
        return newHistory
      })

      setTimeLabels((prev) => {
        const newLabels = [...prev, timeLabel]
        if (newLabels.length > 20) {
          return newLabels.slice(-20)
        }
        return newLabels
      })
    }
  }, [hashRate, mining])

  // Calculate estimated earnings
  const calculateEstimatedEarnings = () => {
    if (!mining || hashRate === 0) return { hourly: 0, daily: 0, weekly: 0, monthly: 0 }

    // This is a simplified calculation and would need to be adjusted for actual network parameters
    const blockReward = 0.5 // DOT per block
    const networkHashRate = 10000000 // Example network hash rate
    const blockTime = 6 // seconds

    // Probability of finding a block = (your hash rate / network hash rate)
    const probability = hashRate / networkHashRate

    // Blocks per hour = 3600 / blockTime
    const blocksPerHour = 3600 / blockTime

    // Expected blocks found per hour = probability * blocksPerHour
    const expectedBlocksPerHour = probability * blocksPerHour

    // Hourly earnings = expected blocks * block reward
    const hourly = expectedBlocksPerHour * blockReward

    return {
      hourly,
      daily: hourly * 24,
      weekly: hourly * 24 * 7,
      monthly: hourly * 24 * 30,
    }
  }

  const earnings = calculateEstimatedEarnings()

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="earnings">Earnings</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Mining Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Hash Rate</span>
                      <span className="text-sm font-medium">{hashRate.toLocaleString()} H/s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average Hash Rate</span>
                      <span className="text-sm font-medium">
                        {hashRateHistory.length > 0
                          ? Math.floor(
                              hashRateHistory.reduce((sum, rate) => sum + rate, 0) / hashRateHistory.length,
                            ).toLocaleString()
                          : 0}{" "}
                        H/s
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Peak Hash Rate</span>
                      <span className="text-sm font-medium">
                        {hashRateHistory.length > 0 ? Math.max(...hashRateHistory).toLocaleString() : 0} H/s
                      </span>
                    </div>
                  </div>

                  <div className="h-[150px] flex items-end gap-1">
                    {hashRateHistory.map((rate, index) => {
                      const maxRate = Math.max(...hashRateHistory, 1)
                      const height = (rate / maxRate) * 100
                      return (
                        <div key={index} className="flex-1 flex flex-col items-center">
                          <div className="w-full bg-primary/20 rounded-t" style={{ height: `${height}%` }}></div>
                          <div className="text-[8px] text-muted-foreground mt-1 rotate-90 origin-top-left translate-x-2">
                            {timeLabels[index]?.split(":").slice(0, 2).join(":")}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Mining Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Blocks Mined</span>
                      <span className="text-sm font-medium">{blocksMined}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Difficulty</span>
                      <span className="text-sm font-medium">{difficulty.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Estimated Time per Block</span>
                      <span className="text-sm font-medium">
                        {mining && hashRate > 0 ? `${Math.floor((difficulty * 1000000) / hashRate)} seconds` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Share Difficulty</span>
                      <span className="text-sm font-medium">{(difficulty * 0.1).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <div className="text-sm font-medium mb-2">Mining Efficiency</div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${mining ? 85 : 0}%` }}></div>
                      </div>
                      <span className="text-sm">{mining ? "85%" : "0%"}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="earnings" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Estimated Earnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Hourly</div>
                    <div className="text-xl font-bold">{earnings.hourly.toFixed(6)} DOT</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Daily</div>
                    <div className="text-xl font-bold">{earnings.daily.toFixed(6)} DOT</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Weekly</div>
                    <div className="text-xl font-bold">{earnings.weekly.toFixed(6)} DOT</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Monthly</div>
                    <div className="text-xl font-bold">{earnings.monthly.toFixed(6)} DOT</div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Earnings Factors</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Block Reward</span>
                      <span className="text-sm font-medium">0.5 DOT</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Network Hash Rate</span>
                      <span className="text-sm font-medium">10,000,000 H/s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Your Hash Rate</span>
                      <span className="text-sm font-medium">{hashRate.toLocaleString()} H/s</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Network Share</span>
                      <span className="text-sm font-medium">{((hashRate / 10000000) * 100).toFixed(6)}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Note: These earnings are estimates based on current network conditions and may vary.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hardware" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Hardware Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">GPU Utilization</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${mining ? 95 : 0}%` }}></div>
                      </div>
                      <span className="text-sm">{mining ? "95%" : "0%"}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Memory Usage</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${mining ? 80 : 10}%` }}></div>
                      </div>
                      <span className="text-sm">{mining ? "80%" : "10%"}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Temperature</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${mining ? 75 : 30}%` }}></div>
                      </div>
                      <span className="text-sm">{mining ? "75°C" : "45°C"}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Power Consumption</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${mining ? 90 : 5}%` }}></div>
                      </div>
                      <span className="text-sm">{mining ? "90W" : "5W"}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Hardware Details</div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">WebGPU Device</span>
                      <span className="text-sm font-medium">GPU Accelerated</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Compute Units</span>
                      <span className="text-sm font-medium">32</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Memory</span>
                      <span className="text-sm font-medium">8 GB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Workgroup Size</span>
                      <span className="text-sm font-medium">256</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
