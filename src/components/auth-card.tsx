"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, MailCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useI18n } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { signInAction, signUpAction } from "@/app/login/actions";
import { LoginSchema, SignupSchema } from "@/lib/validation/schemas";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

function SignInForm({ next }: { next?: string }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(LoginSchema), defaultValues: { email: "", password: "" } });

  return (
    <form
      // POST so that a submit without JavaScript can never put the password in the URL or server logs.
      method="post"
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(null);
          const result = await signInAction(values, next);
          if (result?.error) setError(result.error);
        }),
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">{t("auth.email")}</Label>
        <Input id="signin-email" type="email" autoComplete="email" {...form.register("email")} />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">{t("auth.password")}</Label>
        <Input id="signin-password" type="password" autoComplete="current-password" {...form.register("password")} />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {t("auth.signInCta")}
      </Button>
    </form>
  );
}

function SignUpForm() {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(SignupSchema), defaultValues: { name: "", email: "", password: "" } });

  if (confirm) {
    return (
      <Alert variant="success">
        <MailCheck aria-hidden />
        <AlertDescription>{t("auth.checkEmail")}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form
      // POST so that a submit without JavaScript can never put the password in the URL or server logs.
      method="post"
      noValidate
      className="space-y-4"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(null);
          const result = await signUpAction(values);
          if (result?.error) setError(result.error);
          if (result?.needsConfirmation) setConfirm(true);
        }),
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">{t("auth.name")}</Label>
        <Input id="signup-name" autoComplete="name" {...form.register("name")} />
        <FieldError message={form.formState.errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">{t("auth.email")}</Label>
        <Input id="signup-email" type="email" autoComplete="email" {...form.register("email")} />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">{t("auth.password")}</Label>
        <Input id="signup-password" type="password" autoComplete="new-password" {...form.register("password")} />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {t("auth.signUpCta")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("auth.operatorNote")}</p>
    </form>
  );
}

export function AuthCard({ defaultTab = "signin", next, configured }: { defaultTab?: "signin" | "signup"; next?: string; configured: boolean }) {
  const { t } = useI18n();
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{t("app.name")}</CardTitle>
        <CardDescription>{t("app.tagline")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!configured ? (
          <Alert variant="warning" className="mb-4">
            <AlertDescription>{t("auth.notConfigured")}</AlertDescription>
          </Alert>
        ) : null}
        <Tabs defaultValue={defaultTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">{t("auth.signIn")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.signUp")}</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <SignInForm next={next} />
          </TabsContent>
          <TabsContent value="signup">
            <SignUpForm />
          </TabsContent>
        </Tabs>
        <p className="mt-4 text-center text-xs text-muted-foreground">{t("auth.demoAccounts")}</p>
      </CardContent>
    </Card>
  );
}
