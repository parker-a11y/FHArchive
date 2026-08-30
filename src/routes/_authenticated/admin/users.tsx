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
} from "@/lib/profiles.functions";
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
      { title: "User Management — The Francis Files" },
      {
        name: "description",
        content: "Approve or manage archive guest accounts.",
      },
      { property: "og:title", content: "User Management — The Francis Files" },
      {
        property: "og:description",
        content: "Approve or manage archive guest accounts.",
      },
    ],
  }),
  component: UserManagementPage,
});

function UserManagementPage() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const listProfilesFn = useServerFn(listProfiles);
  const updateStatusFn = useServerFn(updateProfileStatus);
  const deleteAccountFn = useServerFn(deleteGuestAccount);

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
        title="User management"
        description="Review, approve, and revoke guest access to the archive."
      />
      <div className="p-4 sm:p-8">
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
                  <TableHead>Roles</TableHead>
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
                    <TableCell>{profile.roles.join(", ") || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {profile.status !== "approved" ? (
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
                        <DeleteAccountDialog
                          profile={profile}
                          onConfirm={() => deleteMutation.mutate(profile.id)}
                          disabled={deleteMutation.isPending}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {data?.profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
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
