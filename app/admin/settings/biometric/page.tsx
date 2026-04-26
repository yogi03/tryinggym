"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, doc, getDocs, setDoc, deleteDoc, Timestamp } from "firebase/firestore";
import AdminSidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Server, Copy, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BiometricDevice {
  id: string;
  machineNo: number;
  machineType: string;
  serialNo: string;
  portNo: number;
  machineName: string;
  branchName: string;
  timezone: string;
  mode: "in" | "out" | "both";
  deviceToken: string;
  serverUrl: string;
  lastSeen?: Timestamp;
  status: "active" | "inactive";
  createdAt: Timestamp;
}

export default function BiometricSettingsPage() {
  const { adminData, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    machineNo: 1,
    machineType: "Realtime Face 902",
    serialNo: "",
    portNo: 5005,
    machineName: "Main Entrance",
    branchName: "Main Branch",
    timezone: "Asia/Kolkata",
    mode: "both" as "in" | "out" | "both",
  });

  const fetchDevices = async () => {
    if (!adminData?.gymId) return;
    try {
      const snapshot = await getDocs(collection(db, "gyms", adminData.gymId, "biometricDevices"));
      const devicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BiometricDevice));
      setDevices(devicesData);
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast({ title: "Error", description: "Failed to load devices", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDevices();
    }
  }, [adminData, authLoading]);

  const handleSave = async () => {
    if (!adminData?.gymId) return;
    if (!formData.serialNo) {
      toast({ title: "Validation Error", description: "Serial number is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const newDeviceId = doc(collection(db, "gyms", adminData.gymId, "biometricDevices")).id;
      const deviceToken = crypto.randomUUID();
      const serverUrl = `${window.location.origin}/api/biometric/${deviceToken}`;

      const newDeviceData = {
        ...formData,
        deviceToken,
        serverUrl,
        status: "active",
        createdAt: Timestamp.now(),
      };

      await setDoc(doc(db, "gyms", adminData.gymId, "biometricDevices", newDeviceId), newDeviceData);
      
      toast({ title: "Success", description: "Biometric device added successfully." });
      setShowAddModal(false);
      setFormData({
        machineNo: 1,
        machineType: "Realtime Face 902",
        serialNo: "",
        portNo: 5005,
        machineName: "Main Entrance",
        branchName: "Main Branch",
        timezone: "Asia/Kolkata",
        mode: "both",
      });
      fetchDevices();
    } catch (error) {
      console.error("Error saving device:", error);
      toast({ title: "Error", description: "Failed to add device", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (deviceId: string) => {
    if (!adminData?.gymId) return;
    if (!confirm("Are you sure you want to delete this device?")) return;

    try {
      await deleteDoc(doc(db, "gyms", adminData.gymId, "biometricDevices", deviceId));
      toast({ title: "Deleted", description: "Device removed successfully." });
      fetchDevices();
    } catch (error) {
      console.error("Error deleting device:", error);
      toast({ title: "Error", description: "Failed to delete device", variant: "destructive" });
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast({ title: "Copied!", description: "Server URL copied to clipboard." });
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const isOnline = (lastSeen?: Timestamp) => {
    if (!lastSeen) return false;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    return lastSeen.toDate() > twoMinutesAgo;
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6 pt-12 lg:pt-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Biometric Devices</h1>
              <p className="text-muted-foreground text-sm">
                Manage Realtime attendance devices connected to your gym.
              </p>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </div>

          <div className="grid gap-6">
            {devices.length === 0 ? (
              <div className="text-center py-12 bg-muted/5 rounded-lg border border-white/5">
                <Server className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-white/70">No devices registered</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">Add your first biometric device to sync attendance automatically.</p>
                <Button variant="outline" onClick={() => setShowAddModal(true)}>Register Device</Button>
              </div>
            ) : (
              devices.map((device) => (
                <Card key={device.id}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                      <div className="space-y-4 flex-1">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-xl font-semibold">{device.machineName}</h3>
                            {isOnline(device.lastSeen) ? (
                              <span className="flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full font-medium">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                Online
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs bg-rose-500/10 text-rose-400 px-2 py-1 rounded-full font-medium">
                                <span className="w-2 h-2 rounded-full bg-rose-400" />
                                Offline
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {device.machineType} • SN: {device.serialNo} • {device.branchName}
                          </p>
                        </div>

                        <div className="bg-muted/10 p-3 rounded-lg border border-white/10 relative group">
                          <p className="text-xs text-muted-foreground mb-1.5">Web Server URL (Enter this in your device)</p>
                          <div className="flex items-center justify-between gap-2 bg-black/40 px-3 py-2 rounded border border-white/5 font-mono text-xs overflow-x-auto text-primary">
                            {device.serverUrl}
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6 shrink-0" 
                              onClick={() => copyToClipboard(device.serverUrl)}
                            >
                              {copiedUrl === device.serverUrl ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end gap-4 min-w-[200px]">
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">Mode: <span className="text-white capitalize">{device.mode === 'both' ? 'In & Out' : device.mode}</span></p>
                          <p className="text-muted-foreground mt-1">Last Seen: <span className="text-white">{device.lastSeen ? device.lastSeen.toDate().toLocaleString() : 'Never'}</span></p>
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(device.id)}>
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Biometric Device</DialogTitle>
            <DialogDescription>
              Enter device details to generate a connection URL.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Machine No</Label>
                <Input 
                  type="number" 
                  value={formData.machineNo} 
                  onChange={(e) => setFormData({ ...formData, machineNo: parseInt(e.target.value) || 1 })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Port No</Label>
                <Input 
                  type="number" 
                  value={formData.portNo} 
                  onChange={(e) => setFormData({ ...formData, portNo: parseInt(e.target.value) || 5005 })} 
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Machine Type/Model</Label>
              <Input 
                value={formData.machineType} 
                onChange={(e) => setFormData({ ...formData, machineType: e.target.value })} 
                placeholder="e.g. Realtime Face 902"
              />
            </div>

            <div className="space-y-2">
              <Label>Serial No</Label>
              <Input 
                value={formData.serialNo} 
                onChange={(e) => setFormData({ ...formData, serialNo: e.target.value })} 
                placeholder="e.g. RSS202510128516"
              />
            </div>

            <div className="space-y-2">
              <Label>Friendly Name</Label>
              <Input 
                value={formData.machineName} 
                onChange={(e) => setFormData({ ...formData, machineName: e.target.value })} 
                placeholder="e.g. Main Entrance"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Branch</Label>
                <Input 
                  value={formData.branchName} 
                  onChange={(e) => setFormData({ ...formData, branchName: e.target.value })} 
                />
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={formData.timezone} onValueChange={(val) => setFormData({ ...formData, timezone: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Operating Mode</Label>
              <Select value={formData.mode} onValueChange={(val: any) => setFormData({ ...formData, mode: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">In & Out (Both)</SelectItem>
                  <SelectItem value="in">In Only</SelectItem>
                  <SelectItem value="out">Out Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Server URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
