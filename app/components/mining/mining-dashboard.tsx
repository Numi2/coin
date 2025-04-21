"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Cpu, Database, Zap, Server, CheckCircle2, AlertTriangle } from "lucide-react"
import type { WasmMiner } from "@/lib/wasm-miner"
import { substrateClient } from "@/lib/substrate-rpc"
import { useToast } from "@/hooks/use-toast"
import MiningLog from "./mining-log"
import MiningStats from "./mining-stats"

interface MiningDashboardProps {
  miner: WasmMiner | null
  selectedAccount: string | null
}

export default function MiningDashboard({ miner, selectedAccount }: MiningDashboardProps) {
  const [mining, setMining] = useState(false)
  const [hashRate, setHashRate] = useState(0)
  const [difficulty, setDifficulty] = useState(3.5)
  const [blocksMined, setBlocksMined] = useState(0)
  const [logs, setLogs] = useState<{ time: string; component: string; message: string; type: string }[]>([])
  const [activeTab, setActiveTab] = useState("dashboard")
  const [miningSuccess, setMiningSuccess] = useState(false)
  const [currentBlockNumber, setCurrentBlockNumber] = useState(0)
  const { toast } = useToast()

  // Add log entry
  const addLog = (message: string, component = "System", type = "info") => {
    const now = new Date()
    const time = now.toLocaleTimeString()
    setLogs((prev) => [...prev, { time, component, message, type }])
  }

  // Initialize mining dashboard
  useEffect(() => {
    if (!miner) return

    // Get current block number
    const getCurrentBlock = async () => {
      try {
        const blockNumber = await substrateClient.getCurrentBlockNumber()
        setCurrentBlockNumber(blockNumber)
        addLog(`Current block height: ${blockNumber}`, "Blockchain", "info")
      } catch (error) {
        console.error("Failed to get current block number:", error)
        addLog("Failed to get current block number", "Blockchain", "error")
      }
    }

    getCurrentBlock()

    // Subscribe to new blocks
    const unsubscribe = substrateClient.subscribeToNewBlocks((blockNumber) => {
      setCurrentBlockNumber(blockNumber)
      addLog(`New block: #${blockNumber}`, "Blockchain", "info")
    })

    // Set up block found handler
    miner.onBlockFound((blockData) => {
      handleBlockFound(blockData)
    })

    // Add initial logs
    addLog("Mining dashboard initialized", "System", "info")
    addLog("WebGPU miner loaded", "Miner", "info")
    addLog("Ready to start mining", "Miner", "info")

    return () => {
      unsubscribe()
    }
  }, [miner])

  // Start mining
  const startMining = async () => {
    if (!miner) {
      toast({
        title: "Error",
        description: "Mining module not initialized",
        variant: "destructive",
      })
      return
    }

    if (!selectedAccount) {
      toast({
        title: "Error",
        description: "Please select an account first",
        variant: "destructive",
      })
      return
    }

    setMining(true)
    setMiningSuccess(false)

    // Generate block template
    addLog("Generating block template...", "Miner", "info")
    const blockTemplate = `template_${currentBlockNumber}_${Math.random().toString(36).substring(2, 10)}`

    // Start WebGPU mining
    await miner.startMining(difficulty, blockTemplate)
    addLog("Mining started", "Miner", "info")
    addLog(`Mining to account: ${selectedAccount}`, "Miner", "info")
    addLog(`Target difficulty: ${difficulty}`, "Miner", "info")

    // Simulate increasing hash rate
    const hashRateInterval = setInterval(() => {
      const newHashRate = Math.floor(Math.random() * 500000) + 500000
      setHashRate(newHashRate)
    }, 2000)

    return () => {
      clearInterval(hashRateInterval)
    }
  }

  // Stop mining
  const stopMining = async () => {
    if (!miner) return

    await miner.stopMining()
    setMining(false)
    setHashRate(0)
    addLog("Mining stopped", "Miner", "info")

    toast({
      title: "Mining Stopped",
      description: "Mining operations have been stopped",
    })
  }

  // Handle block found
  const handleBlockFound = async (blockData: string) => {
    try {
      addLog(`Potential block found: ${blockData.substring(0, 20)}...`, "Miner", "success")

      // Validate block
      addLog("Validating block...", "Miner", "info")
      const isValid = await miner!.validateBlock(blockData)

      if (isValid) {
        // Block is valid
        setBlocksMined((prev) => prev + 1)
        setMiningSuccess(true)
        addLog("Block successfully mined and validated!", "Miner", "success")
        addLog(`Block data: ${blockData.substring(0, 30)}...`, "Miner", "info")

        // Increase difficulty slightly
        setDifficulty((prev) => +(prev + Math.random() * 0.2).toFixed(1))

        toast({
          title: "Block Mined!",
          description: "Successfully mined a new block",
        })

        // Reset success message after a delay
        setTimeout(() => {
          setMiningSuccess(false)
        }, 5000)
      } else {
        // Block is invalid
        addLog("Block validation failed", "Miner", "error")

        toast({
          title: "Validation Failed",
          description: "The mined block failed validation",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error handling mined block:", error)
      addLog(`Error processing mined block: ${error}`, "Miner", "error")

      toast({
        title: "Processing Error",
        description: "Error processing the mined block",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mining Dashboard</h2>

        <div className="flex items-center gap-2">
          <Badge variant={mining ? "default" : "outline"}>{mining ? "Mining Active" : "Mining Inactive"}</Badge>
        </div>
      </div>

      {!miner ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mining Module Not Available</AlertTitle>
          <AlertDescription>
            The WebGPU mining module could not be initialized. Please check if your browser supports WebGPU.
          </AlertDescription>
        </Alert>
      ) : !selectedAccount ? (
        <Alert>
          <AlertTitle>No Account Selected</AlertTitle>
          <AlertDescription>
            Please select an account to start mining. Mining rewards will be sent to the selected account.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex justify-center mb-4">
            {!mining ? (
              <Button
                onClick={startMining}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                size="lg"
              >
                <Zap className="mr-2 h-4 w-4" />
                Start Mining
              </Button>
            ) : (
              <Button onClick={stopMining} variant="outline" size="lg">
                Stop Mining
              </Button>
            )}
          </div>

          {miningSuccess && (
            <Alert className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Block Mined Successfully!</AlertTitle>
              <AlertDescription>
                You have successfully mined a new block. The reward will be processed shortly.
              </AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Cpu className="h-4 w-4" />
                      Mining Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <Badge variant={mining ? "default" : "outline"}>{mining ? "Active" : "Inactive"}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Hash Rate</span>
                        <span className="text-sm font-medium">{hashRate.toLocaleString()} H/s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Blocks Mined</span>
                        <span className="text-sm font-medium">{blocksMined}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Current Block</span>
                        <span className="text-sm font-medium">#{currentBlockNumber}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Network
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Difficulty</span>
                        <span className="text-sm font-medium">{difficulty.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Block Time</span>
                        <span className="text-sm font-medium">6 seconds</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Network</span>
                        <span className="text-sm font-medium">Substrate</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Mining To</span>
                        <span className="text-sm font-medium font-mono truncate max-w-[150px]">{selectedAccount}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                      <Server className="h-4 w-4" />
                      Hardware
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">GPU Utilization</span>
                        <span className="text-sm font-medium">
                          {mining ? `${Math.floor(85 + Math.random() * 15)}%` : "0%"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Memory Usage</span>
                        <span className="text-sm font-medium">
                          {mining ? `${Math.floor(1024 + Math.random() * 512)} MB` : "128 MB"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Temperature</span>
                        <span className="text-sm font-medium">
                          {mining ? `${Math.floor(65 + Math.random() * 15)}°C` : "45°C"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">WebGPU</span>
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        >
                          Enabled
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <MiningStats mining={mining} hashRate={hashRate} blocksMined={blocksMined} difficulty={difficulty} />
            </TabsContent>

            <TabsContent value="logs" className="mt-4">
              <MiningLog logs={logs} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
