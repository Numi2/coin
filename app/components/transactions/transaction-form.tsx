"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react"
import { substrateClient } from "@/lib/substrate-rpc"
import { useToast } from "@/hooks/use-toast"

// Form validation schema
const formSchema = z.object({
  toAddress: z.string().min(1, "Destination address is required"),
  amount: z.coerce
    .number()
    .positive("Amount must be positive")
    .refine((val) => val > 0, "Amount must be greater than 0"),
  memo: z.string().optional(),
})

interface TransactionFormProps {
  fromAddress: string
  balance: string
  onSuccess?: () => void
}

export default function TransactionForm({ fromAddress, balance, onSuccess }: TransactionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [transactionResult, setTransactionResult] = useState<{
    success: boolean
    hash?: string
    error?: string
  } | null>(null)
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toAddress: "",
      amount: 0,
      memo: "",
    },
  })

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    setPasswordDialogOpen(true)
  }

  const confirmTransaction = async () => {
    if (!password) {
      toast({
        title: "Error",
        description: "Please enter your password",
        variant: "destructive",
      })
      return
    }

    const values = form.getValues()
    setIsSubmitting(true)
    setTransactionResult(null)

    try {
      // Convert amount to blockchain format (multiply by 1e12 for DOT)
      const amountInSmallestUnit = (Number.parseFloat(values.amount.toString()) * 1e12).toString()

      // Send the transaction
      const result = await substrateClient.sendTransaction(
        fromAddress,
        values.toAddress,
        amountInSmallestUnit,
        password,
      )

      setTransactionResult(result)

      if (result.success) {
        toast({
          title: "Transaction Sent",
          description: "Your transaction has been submitted to the network",
        })

        // Reset form on success
        form.reset()

        // Call onSuccess callback if provided
        if (onSuccess) {
          onSuccess()
        }
      } else {
        toast({
          title: "Transaction Failed",
          description: result.error || "Failed to send transaction",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Transaction error:", error)
      setTransactionResult({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      })

      toast({
        title: "Transaction Error",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const availableBalance = Number.parseFloat(balance) / 1e12

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="toAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination Address</FormLabel>
                <FormControl>
                  <Input placeholder="5..." {...field} />
                </FormControl>
                <FormDescription>The recipient's Substrate address</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (DOT)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.000001" {...field} />
                </FormControl>
                <FormDescription>Available balance: {availableBalance.toFixed(6)} DOT</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="memo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Memo (Optional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Add a note to this transaction" {...field} />
                </FormControl>
                <FormDescription>A message to include with the transaction</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full">
            Review Transaction
          </Button>
        </form>
      </Form>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Transaction</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">From:</div>
              <div className="font-mono truncate">{fromAddress}</div>

              <div className="text-muted-foreground">To:</div>
              <div className="font-mono truncate">{form.getValues().toAddress}</div>

              <div className="text-muted-foreground">Amount:</div>
              <div>{form.getValues().amount} DOT</div>

              {form.getValues().memo && (
                <>
                  <div className="text-muted-foreground">Memo:</div>
                  <div>{form.getValues().memo}</div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Enter your password to sign the transaction
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your wallet password"
              />
            </div>

            {transactionResult && (
              <Alert variant={transactionResult.success ? "default" : "destructive"}>
                <AlertTitle className="flex items-center gap-2">
                  {transactionResult.success ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  {transactionResult.success ? "Transaction Sent" : "Transaction Failed"}
                </AlertTitle>
                <AlertDescription>
                  {transactionResult.success ? `Transaction hash: ${transactionResult.hash}` : transactionResult.error}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={confirmTransaction} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Sign & Send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
