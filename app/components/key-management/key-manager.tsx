"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Download, Upload, Plus, Copy, Edit2, Trash2, Eye, EyeOff } from "lucide-react"
import { keyStorage } from "./key-storage"
import { substrateClient } from "@/lib/substrate-rpc"
import { useToast } from "@/hooks/use-toast"

interface KeyManagerProps {
  onAccountSelect?: (publicKey: string) => void
  selectedAccount?: string | null
  showAdvanced?: boolean
}

export default function KeyManager({ onAccountSelect, selectedAccount, showAdvanced = false }: KeyManagerProps) {
  const [accounts, setAccounts] = useState<{ publicKey: string; name: string; lastAccessed: Date }[]>([])
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [mnemonic, setMnemonic] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [importData, setImportData] = useState("")
  const [exportedData, setExportedData] = useState("")
  const [accountToRename, setAccountToRename] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null)
  const [deletePassword, setDeletePassword] = useState("")
  const [showMnemonic, setShowMnemonic] = useState(false)
  const [activeTab, setActiveTab] = useState("create")
  const { toast } = useToast()

  // Load accounts
  useEffect(() => {
    const loadAccounts = async () => {
      const accounts = await keyStorage.getAllPublicKeys()
      setAccounts(accounts)
    }

    loadAccounts()
  }, [])

  // Generate new mnemonic
  const generateMnemonic = () => {
    const newMnemonic = substrateClient.generateMnemonic()
    setMnemonic(newMnemonic)
  }

  // Create account from mnemonic
  const handleCreateAccount = async () => {
    if (!mnemonic) {
      toast({
        title: "Error",
        description: "Please generate a mnemonic phrase",
        variant: "destructive",
      })
      return
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      })
      return
    }

    try {
      const address = await substrateClient.createAccountFromMnemonic(mnemonic, password)

      toast({
        title: "Account Created",
        description: "Your new account has been created successfully",
      })

      // Refresh accounts
      const accounts = await keyStorage.getAllPublicKeys()
      setAccounts(accounts)

      // Select the new account
      if (onAccountSelect) {
        onAccountSelect(address)
      }

      // Reset form
      setMnemonic("")
      setPassword("")
      setConfirmPassword("")
      setCreateDialogOpen(false)
    } catch (error) {
      console.error("Failed to create account:", error)
      toast({
        title: "Error",
        description: "Failed to create account",
        variant: "destructive",
      })
    }
  }

  // Import wallet
  const handleImportWallet = async () => {
    if (!importData || !password) {
      toast({
        title: "Error",
        description: "Please provide the wallet data and password",
        variant: "destructive",
      })
      return
    }

    try {
      const publicKey = await keyStorage.importWallet(importData, password)

      if (!publicKey) {
        throw new Error("Failed to import wallet")
      }

      toast({
        title: "Wallet Imported",
        description: "Your wallet has been imported successfully",
      })

      // Refresh accounts
      const accounts = await keyStorage.getAllPublicKeys()
      setAccounts(accounts)

      // Select the imported account
      if (onAccountSelect) {
        onAccountSelect(publicKey)
      }

      // Reset form
      setImportData("")
      setPassword("")
      setImportDialogOpen(false)
    } catch (error) {
      console.error("Failed to import wallet:", error)
      toast({
        title: "Error",
        description: "Failed to import wallet. Please check your data and password.",
        variant: "destructive",
      })
    }
  }

  // Export wallet
  const handleExportWallet = async () => {
    if (!selectedAccount || !password) {
      toast({
        title: "Error",
        description: "Please select an account and enter your password",
        variant: "destructive",
      })
      return
    }

    try {
      const exportedData = await keyStorage.exportWallet(selectedAccount, password)

      if (!exportedData) {
        throw new Error("Failed to export wallet")
      }

      setExportedData(exportedData)
      toast({
        title: "Wallet Exported",
        description: "Your wallet has been exported successfully",
      })
    } catch (error) {
      console.error("Failed to export wallet:", error)
      toast({
        title: "Error",
        description: "Failed to export wallet. Please check your password.",
        variant: "destructive",
      })
    }
  }

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied",
        description: "Copied to clipboard",
      })
    } catch (error) {
      console.error("Failed to copy to clipboard:", error)
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  // Download exported wallet
  const downloadWallet = () => {
    const blob = new Blob([exportedData], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `wallet-${selectedAccount?.substring(0, 8)}.backup`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Rename account
  const handleRenameAccount = async () => {
    if (!accountToRename || !newName) {
      toast({
        title: "Error",
        description: "Please provide a name for the account",
        variant: "destructive",
      })
      return
    }

    try {
      const success = await keyStorage.updateKeyPairName(accountToRename, newName)

      if (!success) {
        throw new Error("Failed to rename account")
      }

      toast({
        title: "Account Renamed",
        description: "Your account has been renamed successfully",
      })

      // Refresh accounts
      const accounts = await keyStorage.getAllPublicKeys()
      setAccounts(accounts)

      // Reset form
      setAccountToRename(null)
      setNewName("")
      setRenameDialogOpen(false)
    } catch (error) {
      console.error("Failed to rename account:", error)
      toast({
        title: "Error",
        description: "Failed to rename account",
        variant: "destructive",
      })
    }
  }

  // Delete account
  const handleDeleteAccount = async () => {
    if (!accountToDelete || !deletePassword) {
      toast({
        title: "Error",
        description: "Please enter your password to confirm deletion",
        variant: "destructive",
      })
      return
    }

    try {
      // Verify password by attempting to get the private key
      const privateKey = await keyStorage.getPrivateKey(accountToDelete, deletePassword)

      if (!privateKey) {
        toast({
          title: "Error",
          description: "Invalid password",
          variant: "destructive",
        })
        return
      }

      const success = await keyStorage.deleteKeyPair(accountToDelete)

      if (!success) {
        throw new Error("Failed to delete account")
      }

      toast({
        title: "Account Deleted",
        description: "Your account has been deleted successfully",
      })

      // Refresh accounts
      const accounts = await keyStorage.getAllPublicKeys()
      setAccounts(accounts)

      // If the deleted account was selected, select another account
      if (selectedAccount === accountToDelete && onAccountSelect) {
        onAccountSelect(accounts.length > 0 ? accounts[0].publicKey : null)
      }

      // Reset form
      setAccountToDelete(null)
      setDeletePassword("")
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error("Failed to delete account:", error)
      toast({
        title: "Error",
        description: "Failed to delete account",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      {/* Account List */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((account) => (
            <Card
              key={account.publicKey}
              className={`cursor-pointer transition-colors ${
                selectedAccount === account.publicKey ? "border-primary" : ""
              }`}
              onClick={() => onAccountSelect && onAccountSelect(account.publicKey)}
            >
              <CardContent className="p-4 flex justify-between items-center">
                <div className="overflow-hidden">
                  <div className="font-medium">{account.name}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">{account.publicKey}</div>
                </div>

                {showAdvanced && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAccountToRename(account.publicKey)
                        setNewName(account.name)
                        setRenameDialogOpen(true)
                      }}
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="sr-only">Rename</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation()
                        setAccountToDelete(account.publicKey)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create New Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Key</DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create">Create</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="mnemonic">Mnemonic Phrase</Label>
                  <div className="relative">
                    <Input
                      id="mnemonic"
                      value={mnemonic}
                      onChange={(e) => setMnemonic(e.target.value)}
                      className="pr-10"
                      type={showMnemonic ? "text" : "password"}
                      placeholder="Enter or generate a mnemonic phrase"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0"
                      onClick={() => setShowMnemonic(!showMnemonic)}
                    >
                      {showMnemonic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      <span className="sr-only">{showMnemonic ? "Hide" : "Show"} mnemonic</span>
                    </Button>
                  </div>
                  <Button variant="outline" size="sm" onClick={generateMnemonic}>
                    Generate Mnemonic
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter a secure password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                  />
                </div>

                <Alert>
                  <AlertDescription>
                    Make sure to save your mnemonic phrase in a secure location. It's the only way to recover your
                    account if you lose your password.
                  </AlertDescription>
                </Alert>
              </TabsContent>

              <TabsContent value="advanced" className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Advanced Options</Label>
                  <p className="text-sm text-muted-foreground">
                    Advanced key creation options will be available in a future update.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateAccount}>Create Account</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Key</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="importData">Wallet Backup Data</Label>
                <Input
                  id="importData"
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder="Paste your wallet backup data"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="importPassword">Password</Label>
                <Input
                  id="importPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your wallet password"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleImportWallet}>Import Wallet</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {selectedAccount && (
          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Key</DialogTitle>
              </DialogHeader>

              {!exportedData ? (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="exportPassword">Password</Label>
                    <Input
                      id="exportPassword"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your wallet password"
                    />
                  </div>

                  <Alert>
                    <AlertDescription>
                      Your exported wallet will be encrypted with your password. Keep this backup in a secure location.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Encrypted Wallet Data</Label>
                    <div className="bg-muted p-2 rounded-md text-xs font-mono break-all max-h-32 overflow-y-auto">
                      {exportedData}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                {!exportedData ? (
                  <>
                    <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleExportWallet}>Export</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => copyToClipboard(exportedData)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to Clipboard
                    </Button>
                    <Button onClick={downloadWallet}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Account</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newName">New Name</Label>
              <Input
                id="newName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter a new name for this account"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameAccount}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                Warning: This action cannot be undone. Make sure you have a backup of your account before proceeding.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="deletePassword">Password</Label>
              <Input
                id="deletePassword"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter your password to confirm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
