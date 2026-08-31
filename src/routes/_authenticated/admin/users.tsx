import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle, XCircle, Trash2, UserPlus, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  listProfiles,
  updateProfileStatus,
  deleteGuestAccount,
  setAccountRole,
  createAccount,
} from "@/lib/profiles.functions";
import { Switch } from "@/components/ui/switch";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Account Control — The Francis Files" },
      {
        name: "description",
        content: "Approve accounts and grant Archivist access to the archive.",
      },
      { property: "og:title", content: "Account Control — The Francis Files" },
      {
        property: "og:description",
        content: "Approve accounts and grant Archivist access to the archive.",
      },
    ],
  }),
  component: UserManagementPage,
});

function UserManagementPage() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const listProfilesFn = useServerFn(listProfiles);
  const updateStatusFn = useServerFn(updateProfileStatus);
  const deleteAccountFn = useServerFn(deleteGuestAccount);
  const setRoleFn = useServerFn(setAccountRole);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "profiles"],
    queryFn: () => listProfilesFn(),
    enabled: isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: (userId: string) =>
      updateStatusFn({ data: { userId, status: "approved" } }),
    onSuccess: () => {
      toast.success("Guest approved");
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: (userId: string) =>
      updateStatusFn({ data: { userId, status: "pending" } }),
    onSuccess: () => {
      toast.success("Access revoked");
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "guest" | "archivist" }) =>
      setRoleFn({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.role === "archivist"
          ? "Archivist access granted — notification email sent"
          : "Account returned to view-only guest",
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteAccountFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account removed");
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground">
          You do not have permission to manage users.
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader
        title="Account Control"
        description="Review accounts, approve guests, and grant Archivist editing access."
      />
      <div className="space-y-4 p-4 sm:p-8">
        <div className="flex justify-end">
          <AddAccountDialog />
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Archivist</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.profiles ?? []).map((profile) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.email}</TableCell>
                    <TableCell>{profile.full_name || "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          profile.status === "approved"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                        }`}
                      >
                        {profile.status === "approved" ? (
                          <>
                            <CheckCircle className="size-3" /> Approved
                          </>
                        ) : (
                          <>
                            <XCircle className="size-3" /> Pending
                          </>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">
                      {profile.roles.join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {profile.roles.includes("admin") || profile.id === user?.id ? (
                        <span className="text-xs text-muted-foreground">Owner</span>
                      ) : (
                        <Switch
                          aria-label={`Archivist access for ${profile.email}`}
                          checked={profile.roles.includes("archivist")}
                          disabled={roleMutation.isPending || profile.status !== "approved"}
                          onCheckedChange={(v) =>
                            roleMutation.mutate({
                              userId: profile.id,
                              role: v ? "archivist" : "guest",
                            })
                          }
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {profile.roles.includes("admin") || profile.id === user?.id ? (
                          <span className="text-xs text-muted-foreground">
                            Administrator
                          </span>
                        ) : profile.status !== "approved" ? (
                          <Button
                            size="sm"
                            onClick={() => approveMutation.mutate(profile.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="mr-1 size-3.5" />
                            Approve
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => revokeMutation.mutate(profile.id)}
                            disabled={revokeMutation.isPending}
                          >
                            <XCircle className="mr-1 size-3.5" />
                            Revoke
                          </Button>
                        )}
                        {!profile.roles.includes("admin") && profile.id !== user?.id && (
                        <DeleteAccountDialog
                          profile={profile}
                          onConfirm={() => deleteMutation.mutate(profile.id)}
                          disabled={deleteMutation.isPending}
                        />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No user accounts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DeleteAccountDialog({
  profile,
  onConfirm,
  disabled,
}: {
  profile: { email: string; full_name?: string | null };
  onConfirm: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="size-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove account?</AlertDialogTitle>
          <AlertDialogDescription>
            This will delete the profile and role records for{" "}
            <strong>{profile.full_name || profile.email}</strong>. The auth user may still exist in
            Supabase Auth, but they will no longer be able to access the archive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
            disabled={disabled}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AddAccountDialog() {
  const queryClient = useQueryClient();
  const createAccountFn = useServerFn(createAccount);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"guest" | "archivist">("guest");
  const [password, setPassword] = useState("");
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createAccountFn({
        data: { email, fullName, role, password: password || undefined },
      }),
    onSuccess: (res) => {
      setCreated({ email: res.email, password: res.password });
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("guest");
      queryClient.invalidateQueries({ queryKey: ["admin", "profiles"] });
      toast.success("Account created and approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setCreated(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="mr-1 size-4" />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{created ? "Account created" : "Add a new account"}</DialogTitle>
          <DialogDescription>
            {created
              ? "Share these sign-in details privately. The user can change the password after signing in."
              : "Creates an approved account immediately — no invitation or approval step needed."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                <span className="text-muted-foreground">Email: </span>
                {created.email}
              </div>
              <div className="mt-1 font-mono">
                <span className="font-sans text-muted-foreground">Password: </span>
                {created.password}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(
                  `Email: ${created.email}\nPassword: ${created.password}`,
                );
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="mr-1 size-3.5" />
              Copy details
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Full name (optional)</Label>
              <Input
                id="new-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Access level</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "guest" | "archivist")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">Guest — view only</SelectItem>
                  <SelectItem value="archivist">Archivist — can edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Temporary password (optional)</Label>
              <Input
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to generate one"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {created ? (
            <Button onClick={() => setOpen(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !email.trim()}
              >
                {mutation.isPending ? "Creating…" : "Create account"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
