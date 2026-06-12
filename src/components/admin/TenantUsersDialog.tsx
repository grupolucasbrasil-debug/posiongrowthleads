import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "vendedor", label: "SDR / Vendedor" },
  { value: "recepcao", label: "Recepção / Médico" },
  { value: "viewer", label: "Visualizador" },
];

interface TUser { id: string; user_id: string; role: string; active: boolean; email?: string }

export function TenantUsersDialog({
  tenantId, tenantName, open, onOpenChange,
}: { tenantId: string | null; tenantName: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [users, setUsers] = useState<TUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("admin");
  const [tempPwd, setTempPwd] = useState<{ email: string; password: string } | null>(null);

  async function load() {
    if (!tenantId) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("tenant_users").select("id, user_id, role, active")
      .eq("tenant_id", tenantId);
    // fetch emails via edge function? Use auth schema not exposed; show user_id short.
    setUsers((rows || []).map((r: any) => ({ ...r })));
    setLoading(false);
  }

  useEffect(() => { if (open && tenantId) { setTempPwd(null); load(); } /* eslint-disable-next-line */ }, [open, tenantId]);

  async function invite() {
    if (!tenantId || !email) return;
    setInviting(true); setTempPwd(null);
    const { data, error } = await supabase.functions.invoke("invite-tenant-user", {
      body: { email, role, tenant_id: tenantId },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Falha ao convidar");
      return;
    }
    if ((data as any).temp_password) {
      setTempPwd({ email, password: (data as any).temp_password });
      toast.success("Usuário criado — senha temporária gerada");
    } else {
      toast.success("Usuário já existente vinculado à clínica");
    }
    setEmail(""); load();
  }

  async function updateRole(id: string, r: string) {
    const { error } = await supabase.from("tenant_users").update({ role: r as any }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Função atualizada"); load(); }
  }
  async function toggleActive(id: string, v: boolean) {
    const { error } = await supabase.from("tenant_users").update({ active: v }).eq("id", id);
    if (error) toast.error(error.message); else load();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Usuários — {tenantName}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> Convidar usuário</div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-2">
            <Input placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button onClick={invite} disabled={inviting || !email}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Convidar"}
            </Button>
          </div>
          {tempPwd && (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <KeyRound className="w-4 h-4" /> Senha temporária gerada para {tempPwd.email}
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-2 py-1 rounded bg-background border border-border font-mono text-sm">{tempPwd.password}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tempPwd.password); toast.success("Copiado"); }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Envie ao usuário e peça para trocar no primeiro acesso (via "Esqueci minha senha").</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhum usuário vinculado</TableCell></TableRow>
                )}
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.user_id.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(v) => updateRole(u.id, v)}>
                        <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch checked={u.active} onCheckedChange={(v) => toggleActive(u.id, v)} />
                        <Badge variant={u.active ? "default" : "outline"} className={u.active ? "bg-emerald-500/15 text-emerald-400" : ""}>
                          {u.active ? "ativo" : "inativo"}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
