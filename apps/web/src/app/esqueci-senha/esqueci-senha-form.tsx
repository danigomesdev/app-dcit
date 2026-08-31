"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  requestReset,
  resetPassword,
  type RequestResetState,
  type ResetPasswordState,
} from "./actions";
import styles from "../login/page.module.css";

const initialRequestState: RequestResetState = { identifier: null, devCode: null, error: null };
const initialResetState: ResetPasswordState = { error: null, success: false };

export function EsqueciSenhaForm() {
  const [requestState, requestAction, requestPending] = useActionState(
    requestReset,
    initialRequestState,
  );
  const [resetState, resetActionHandler, resetPending] = useActionState(
    resetPassword,
    initialResetState,
  );

  if (resetState.success) {
    return (
      <div className={styles.form}>
        <p>Senha redefinida com sucesso.</p>
        <Link href="/login" className={styles.button}>
          Voltar ao login
        </Link>
      </div>
    );
  }

  if (!requestState.identifier) {
    return (
      <form action={requestAction} className={styles.form}>
        {requestState.error ? <p className={styles.error}>{requestState.error}</p> : null}
        <input
          type="text"
          name="identifier"
          placeholder="Email ou telefone"
          required
          className={styles.input}
        />
        <button type="submit" className={styles.button} disabled={requestPending}>
          Enviar código
        </button>
        <Link href="/login" className={styles.link}>
          Voltar ao login
        </Link>
      </form>
    );
  }

  return (
    <form action={resetActionHandler} className={styles.form}>
      {requestState.devCode ? (
        <p className={styles.devCode}>
          Modo de desenvolvimento — em produção isso chegaria por email/SMS. Código:{" "}
          <strong>{requestState.devCode}</strong>
        </p>
      ) : (
        <p className={styles.description}>Se essa conta existir, um código foi gerado.</p>
      )}
      {resetState.error ? <p className={styles.error}>{resetState.error}</p> : null}
      <input type="hidden" name="identifier" value={requestState.identifier} />
      <input
        type="text"
        name="code"
        placeholder="Código de 6 dígitos"
        required
        maxLength={6}
        className={styles.input}
      />
      <input
        type="password"
        name="newPassword"
        placeholder="Nova senha"
        required
        minLength={8}
        className={styles.input}
      />
      <button type="submit" className={styles.button} disabled={resetPending}>
        Redefinir senha
      </button>
    </form>
  );
}
