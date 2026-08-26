"use client";

import { useState } from "react";

import styles from "./page.module.css";

export default function LoginPage() {
  const [message, setMessage] = useState<string | null>(null);

  function handleSignIn() {
    // TODO: redirect to `${API_URL}/auth/login?origin=web` once the
    // auth/SSO backend (docs/superpowers/plans/2026-08-24-auth-sso-backend.md)
    // is merged and this app reads the session cookie via middleware.
    setMessage("O login com SSO ainda não está conectado.");
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Ponto DCIT</h1>
      <p className={styles.description}>
        Entre com sua conta corporativa para acessar o sistema.
      </p>
      <button type="button" className={styles.button} onClick={handleSignIn}>
        Entrar com SSO
      </button>
      {message ? <p className={styles.description}>{message}</p> : null}
    </div>
  );
}
