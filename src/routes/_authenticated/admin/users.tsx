import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle, XCircle, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  listProfiles,
  updateProfileStatus,
  deleteGuestAccount,
  setAccountRole,
} from "@/lib/profiles.functions";
import { Switch } from "@/components/ui/switch";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
