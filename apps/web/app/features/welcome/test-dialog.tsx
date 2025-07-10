import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Header } from "~/components/base-component/header";
import { DialogRename } from "../folder/dialog-rename";

export function TestDialog() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto p-8 space-y-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2">
            click a button to see dialog
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Button Variants</CardTitle>
            <CardDescription>
              Different button styles and sizes available in shadcn/ui
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Default Folder Action</Label>
              <DialogRename />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
