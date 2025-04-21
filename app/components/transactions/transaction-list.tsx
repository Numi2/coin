"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Eye, ExternalLink } from "lucide-react"
import type { SubstrateTransaction } from "@/lib/substrate-rpc"

interface TransactionListProps {
  transactions: SubstrateTransaction[]
  showViewAll?: () => void
}

export default function TransactionList({ transactions, showViewAll }: TransactionListProps) {
  const [selectedTx, setSelectedTx] = useState<SubstrateTransaction | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatAmount = (amount: string) => {
    return (Number.parseFloat(amount) / 1e12).toFixed(6)
  }

  const truncateAddress = (address: string) => {
    if (address.length <= 12) return address
    return `${address.slice(0, 6)}...${address.slice(-6)}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
          >
            Pending
          </Badge>
        )
      case "success":
        return (
          <Badge
            variant="outline"
            className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
          >
            Confirmed
          </Badge>
        )
      case "failed":
        return (
          <Badge
            variant="outline"
            className="bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
          >
            Failed
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const showTransactionDetails = (tx: SubstrateTransaction) => {
    setSelectedTx(tx)
    setDetailsOpen(true)
  }

  return (
    <div>
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No transactions found</div>
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">{formatDate(tx.timestamp)}</TableCell>
                    <TableCell>{truncateAddress(tx.to)}</TableCell>
                    <TableCell>{formatAmount(tx.amount)} DOT</TableCell>
                    <TableCell>{getStatusBadge(tx.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => showTransactionDetails(tx)}>
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View details</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {showViewAll && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" onClick={showViewAll}>
                View All Transactions
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                <div className="font-medium">Transaction ID:</div>
                <div className="font-mono break-all">{selectedTx.id}</div>

                <div className="font-medium">Date:</div>
                <div>{formatDate(selectedTx.timestamp)}</div>

                <div className="font-medium">Status:</div>
                <div>{getStatusBadge(selectedTx.status)}</div>

                <div className="font-medium">From:</div>
                <div className="font-mono break-all">{selectedTx.from}</div>

                <div className="font-medium">To:</div>
                <div className="font-mono break-all">{selectedTx.to}</div>

                <div className="font-medium">Amount:</div>
                <div>{formatAmount(selectedTx.amount)} DOT</div>

                {selectedTx.fee && (
                  <>
                    <div className="font-medium">Fee:</div>
                    <div>{formatAmount(selectedTx.fee)} DOT</div>
                  </>
                )}

                {selectedTx.extrinsicHash && (
                  <>
                    <div className="font-medium">Extrinsic Hash:</div>
                    <div className="font-mono break-all">{selectedTx.extrinsicHash}</div>
                  </>
                )}

                <div className="font-medium">Block Hash:</div>
                <div className="font-mono break-all">{selectedTx.blockHash}</div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`https://polkadot.subscan.io/extrinsic/${selectedTx.extrinsicHash || selectedTx.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on Explorer
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
