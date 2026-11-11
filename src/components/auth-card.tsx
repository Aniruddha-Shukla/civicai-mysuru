"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock, LoaderCircle, Mail, MailCheck, ShieldCheck, User, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { useI18n } from "@/components/i18n-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { demoSignInAction, signInAction, signUpAction } from "@/app/login/actions";
import { markFreshSignIn } from "@/components/motion/scroll-reset";
import { LoginSchema, SignupSchema } from "@/lib/validation/schemas";

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
}

/** A field with a picture next to it (envelope for email, lock for password) so it is recognisable at a glance. */
function IconField({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary/70" aria-hidden />
      {children}
    </div>
  );
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
          markFreshSignIn();
          const result = await signInAction(values, next);
          if (result?.error) setError(result.error);
        }),
      )}
    >
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">{t("auth.email")}</Label>
        <IconField icon={Mail}>
          <Input id="signin-email" type="email" autoComplete="email" placeholder="name@example.com" className="pl-12" {...form.register("email")} />
        </IconField>
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signin-password">{t("auth.password")}</Label>
        <IconField icon={Lock}>
          <Input id="signin-password" type="password" autoComplete="current-password" className="pl-12" {...form.register("password")} />
        </IconField>
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
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
        <IconField icon={UserRound}>
          <Input id="signup-name" autoComplete="name" className="pl-12" {...form.register("name")} />
        </IconField>
        <FieldError message={form.formState.errors.name?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">{t("auth.email")}</Label>
        <IconField icon={Mail}>
          <Input id="signup-email" type="email" autoComplete="email" placeholder="name@example.com" className="pl-12" {...form.register("email")} />
        </IconField>
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">{t("auth.password")}</Label>
        <IconField icon={Lock}>
          <Input id="signup-password" type="password" autoComplete="new-password" className="pl-12" {...form.register("password")} />
        </IconField>
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {t("auth.signUpCta")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("auth.operatorNote")}</p>
    </form>
  );
}

/** One-click demo sign-in. `hero` renders the large landing-page version. */
export function DemoSignIn({ hero = false }: { hero?: boolean }) {
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"operator" | "citizen" | null>(null);
  const [, startTransition] = useTransition();
  const signIn = (role: "operator" | "citizen") =>
    startTransition(async () => {
      setError(null);
      setPending(role);
      markFreshSignIn();
      const result = await demoSignInAction(role);
      if (result?.error) {
        setError(result.error);
        setPending(null);
      }
    });

  if (hero) {
    return (
      <div className="space-y-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            size="lg"
            data-magnetic
            className="h-14 rounded-2xl bg-white text-base text-primary shadow-lg shadow-black/10 hover:bg-violet-50"
            disabled={pending !== null}
            onClick={() => signIn("citizen")}
          >
            {pending === "citizen" ? <LoaderCircle className="animate-spin" aria-hidden /> : <User aria-hidden />}
            {t("landing.tryCitizen")}
          </Button>
          <Button
            type="button"
            size="lg"
            data-magnetic
            className="h-14 rounded-2xl border border-white/40 bg-white/10 text-base text-white shadow-none backdrop-blur hover:bg-white/20"
            disabled={pending !== null}
            onClick={() => signIn("operator")}
          >
            {pending === "operator" ? <LoaderCircle className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
            {t("landing.tryOperator")}
          </Button>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="text-center text-sm font-semibold">{t("auth.quickTry")}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" size="lg" className="h-12 text-sm" disabled={pending !== null} onClick={() => signIn("citizen")}>
          {pending === "citizen" ? <LoaderCircle className="animate-spin" aria-hidden /> : <User aria-hidden />}
          {t("auth.demoCitizen")}
        </Button>
        <Button type="button" variant="secondary" size="lg" className="h-12 text-sm" disabled={pending !== null} onClick={() => signIn("operator")}>
          {pending === "operator" ? <LoaderCircle className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
          {t("auth.demoOperator")}
        </Button>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

export function AuthCard({
  defaultTab = "signin",
  next,
  configured,
  demoLogin = false,
}: {
  defaultTab?: "signin" | "signup";
  next?: string;
  configured: boolean;
  demoLogin?: boolean;
}) {
  const { t } = useI18n();
  // One simple form at a time (like a paper form), with a plain link to switch — no tabs to understand.
  const [mode, setMode] = useState<"signin" | "signup">(defaultTab);
  const signin = mode === "signin";

  return (
    <div className="w-full space-y-6">
      <h2 className="text-lg font-semibold text-muted-foreground">{signin ? t("auth.welcomeTitle") : t("auth.createTitle")}</h2>
      {!configured ? (
        <Alert variant="warning">
          <AlertDescription>{t("auth.notConfigured")}</AlertDescription>
        </Alert>
      ) : null}

      {signin ? <SignInForm next={next} /> : <SignUpForm />}

      <p className="text-center text-sm text-muted-foreground">
        {signin ? t("auth.newHere") : t("auth.haveAccount")}{" "}
        <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => setMode(signin ? "signup" : "signin")}>
          {signin ? t("auth.signUp") : t("auth.signIn")}
        </button>
      </p>

      {signin && demoLogin ? <DemoSignIn /> : null}
      {demoLogin ? null : <p className="text-center text-xs text-muted-foreground">{t("auth.demoAccounts")}</p>}
    </div>
  );
}
