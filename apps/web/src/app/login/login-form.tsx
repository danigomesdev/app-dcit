"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginWithPassword, type LoginState } from "./actions";
import styles from "./page.module.css";

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginWithPassword, initialState);

  return (
    <form action={formAction} className={styles.form}>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      <input
        type="email"
        name="email"
        placeholder="Email"
        required
        className={styles.input}
      />
      <input
        type="password"
        name="password"
        placeholder="Senha"
        required
        className={styles.input}
      />
      <button type="submit" className={styles.button} disabled={pending}>
        Entrar
      </button>
      <Link href="/esqueci-senha" className={styles.link}>
        Esqueci minha senha
      </Link>
    </form>
  );
}
