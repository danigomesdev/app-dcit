import { EsqueciSenhaForm } from "./esqueci-senha-form";
import styles from "../login/page.module.css";

export default function EsqueciSenhaPage() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Esqueci minha senha</h1>
        <p className={styles.description}>
          Informe seu email ou telefone cadastrado para receber um código de redefinição.
        </p>
        <EsqueciSenhaForm />
      </div>
    </div>
  );
}
