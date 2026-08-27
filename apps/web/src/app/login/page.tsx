import { API_URL } from "@/constants/api";

import styles from "./page.module.css";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Ponto DCIT</h1>
        <p className={styles.description}>
          Entre com sua conta corporativa para acessar o sistema.
        </p>
        {error === "colaborador_web" && (
          <p className={styles.error}>
            O portal web é exclusivo para gestores e RH. Colaboradores devem usar o
            aplicativo móvel.
          </p>
        )}
        <a className={styles.button} href={`${API_URL}/auth/login?origin=web`}>
          Entrar com SSO
        </a>
      </div>
    </div>
  );
}
