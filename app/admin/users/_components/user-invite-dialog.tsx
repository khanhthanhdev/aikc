"use client";

import { PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useServerAction } from "zsa-react";
import { inviteUser } from "~/app/admin/users/_lib/actions";
import { Button } from "~/components/admin/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/admin/ui/dialog";
import { Input } from "~/components/admin/ui/input";

export const UserInviteDialog = () => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const { execute, isPending } = useServerAction(inviteUser, {
    onSuccess: ({ data }) => {
      toast.success(`${data.email} can now sign in to the admin panel`);
      setEmail("");
      setName("");
      setOpen(false);
    },

    onError: ({ err }) => {
      toast.error(err.message);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    execute({ email, name });
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button prefix={<PlusIcon />}>
          <span className="max-sm:sr-only">Add admin</span>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add admin</DialogTitle>
            <DialogDescription>
              They sign in with this Google account. Nothing is sent to them,
              so let them know the admin panel address yourself.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="invite-email">
              Email
            </label>
            <Input
              autoComplete="off"
              autoFocus
              id="invite-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@vinuni.edu.vn"
              required
              type="email"
              value={email}
            />
          </div>

          <div className="grid gap-2">
            <label className="font-medium text-sm" htmlFor="invite-name">
              Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              autoComplete="off"
              id="invite-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Filled in from Google on first sign-in"
              value={name}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>

            <Button disabled={isPending} isPending={isPending} type="submit">
              Add admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
