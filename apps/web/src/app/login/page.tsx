import { LoginForm } from "./login-form";
import styles from "./page.module.css";

export default function LoginPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Ponto DCIT</h1>
        <p className={styles.description}>
          Entre com sua conta corporativa para acessar o sistema.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
