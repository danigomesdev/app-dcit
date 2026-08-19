# Especificação Funcional — Aplicativo de Ponto DCIT (v2)

> **Changelog desta revisão:** removido reconhecimento facial; geolocalização deixa de bloquear a marcação de ponto (passa a ser registrada para auditoria); adicionados requisitos de timestamp confiável, RBAC granular sobre dados sensíveis, geração de AFD, fallback manual e migração de histórico. Ver seção 12 para o detalhamento das mudanças.

## 1. Visão Geral do Projeto

O Ponto DCIT é um aplicativo corporativo que unifica, em uma única plataforma, as funções de um sistema de controle de ponto eletrônico (nível Solides) com as de um portal de recursos humanos (nível "Meu RH"). O objetivo é que o colaborador tenha, em um só lugar, tudo o que precisa relacionado à sua vida funcional — desde a marcação diária de ponto até a gestão de documentos, benefícios, férias e certificações — enquanto gestores e RH ganham visibilidade em tempo real e automação de processos que hoje são manuais.

## 2. Objetivos do Produto

- Centralizar ponto eletrônico + RH em um único app, eliminando a necessidade de múltiplas ferramentas.
- Reduzir erros e esquecimentos de marcação por meio de automações e notificações inteligentes.
- Dar transparência total ao colaborador sobre horas trabalhadas, banco de horas, holerite e benefícios.
- Agilizar aprovações e validações do RH e da gestão (ex: atestados via OCR, aprovação de férias em 1 clique).
- Prevenir riscos trabalhistas (interjornada, excesso de horas extras, férias vencendo) com alertas proativos.
- Suportar times operacionais/técnicos (plantão, sobreaviso, atendimento externo) com funcionalidades específicas.
- Garantir que a marcação de ponto seja **simples e nunca bloqueante** — o botão de marcar ponto sempre funciona, independente de sinal de GPS, rede ou câmera.

## 3. Público-Alvo (Perfis de Usuário)

| Perfil | Necessidades principais |
|---|---|
| Colaborador (CLT) | Bater ponto, ver espelho de ponto, solicitar férias, anexar atestados, ver holerite |
| Colaborador em plantão/campo | Escala, sobreaviso, deslocamento, modo offline |
| Novo contratado | Onboarding guiado, envio de documentos antes do 1º dia |
| Gestor / Líder | Aprovar solicitações, ver mapa de presença, receber alertas preventivos |
| RH / DP | Validar atestados, gerenciar documentos, acompanhar conformidade legal |
| Administrador do sistema | Configurar regras, integrações, permissões e parametrizações |

## 4. Módulos e Funcionalidades

### 4.1 Módulo do Colaborador

**Ponto e jornada**

- Marcação de ponto por **botão único**, sem etapa de verificação biométrica. Um toque registra o ponto imediatamente, com selo de horário confiável (ver seção 5, "Integridade do registro de tempo").
- Captura de geolocalização (GPS) **de forma não bloqueante**: a localização é registrada junto do ponto para fins de auditoria e visibilidade do gestor/RH, mas a ausência de sinal de GPS, imprecisão de localização, ou marcação fora de uma área esperada **nunca impede o registro do ponto**. Divergências de localização geram apenas um sinalizador (flag) informativo no painel de RH/gestor, nunca um bloqueio para o colaborador.
- Espelho de ponto transparente: horas trabalhadas em tempo real, saldo de banco de horas (positivo/negativo), horas extras e estimativa de DSR.
- Horas extras exibidas já convertidas em valor monetário estimado.
- Ajuste automatizado: o app identifica esquecimentos (ex: "Você não registrou a saída do almoço") e envia push no mesmo dia e em dias seguintes até a correção.
- Solicitação de justificativas/ajustes de ponto direto pelo app.

**Documentos e admissão**

- Upload de documentos admissionais no momento do ingresso, organizados para consulta imediata do RH.
- Repositório pessoal de documentos (contrato, holerites, atestados, certificados).

**Atestados com OCR (IA)**

- Foto do atestado → leitura automática de CID, nome do médico, CRM e quantidade de dias.
- Preenchimento automático do formulário e envio para validação do RH em segundos.
- Status de acompanhamento (enviado / em análise / aprovado / recusado).
- **O CID é um dado sensível de saúde (LGPD) e é visível apenas ao RH.** Gestores enxergam somente o resultado agregado da aprovação (ex: "afastamento aprovado, X dias"), nunca o CID, nome do médico ou CRM (ver seção 6, "RBAC granular por dado").

**Férias e folha de ponto**

- Solicitação de férias com visualização de saldo e período aquisitivo.
- Consulta e download da folha de ponto (histórico mensal).

**Holerite interativo**

- Contracheque detalhado com explicação visual dos descontos (INSS, IRRF, benefícios, etc.).

### 4.2 Módulo do Gestor (Portal do Gestor — Dashboard Mobile)

- Aprovações em 1 clique: justificativas de ponto, horas extras e férias em um feed simplificado. **Não inclui dados clínicos de atestados** (CID, médico, CRM) — apenas o resultado da aprovação do RH.
- Mapa de presença ao vivo: quem está trabalhando, em pausa, de folga ou atrasado.
- Alertas preventivos automáticos:
  - Violação de intervalo interjornada.
  - Excesso de horas extras acumuladas.
  - Férias próximas do vencimento (risco de multa trabalhista em dobro).
  - Divergências de geolocalização (informativo, não bloqueante) para marcações fora do padrão esperado.

### 4.3 Comunicação e Engajamento

- Mural de avisos/feed: comunicados da empresa, aniversariantes do dia, boas-vindas a novos colaboradores.
- Onboarding guiado: checklist passo a passo para assinatura de contrato, vídeos de integração e envio de documentos antes do primeiro dia.

### 4.4 Benefícios e Clube de Vantagens

- Gestão de benefícios: extrato e saldo de vale-refeição, vale-transporte e plano de saúde.
- Clube de descontos: parcerias com farmácias, cursos, academias e cinemas integradas ao app.

### 4.5 Módulo Operacional / TI (Plantão e Campo)

- Escalas de plantão e escala rotativa com calendário claro de quem está de plantão (suporte/infraestrutura) na semana.
- Marcação de sobreaviso: botão para ativar/desativar status "Sobreaviso/Standby", com contagem automática de horas de sobreaviso e horas efetivamente trabalhadas em caso de chamado emergencial.
- Registro de deslocamento: início/fim de deslocamento para atendimento externo, integrado a reembolso de km ou transporte.
- **Modo offline com sincronização automática**: garante o registro de ponto mesmo sem sinal (ex: datacenters). Cada marcação offline recebe um timestamp local assinado no momento do toque; ao sincronizar, o sistema valida a assinatura e a janela de tolerância contra o servidor de tempo confiável (ver seção 5). Conflitos (ex: duas marcações para o mesmo evento) são resolvidos priorizando o registro mais antigo e sinalizando o excedente para revisão do RH — nunca descartados silenciosamente.
- Matriz de certificações: espaço para o colaborador anexar certificações (AWS, Azure, Cisco, etc.), com histórico atualizado para o RH e elegibilidade a novos projetos/cargos.

## 5. Requisitos Técnicos e de Integração

- **Autenticação**: login corporativo (SSO/Active Directory). Não há verificação biométrica facial em nenhum fluxo do produto.
- **Integridade do registro de tempo**: todo registro de ponto (online ou offline) recebe um timestamp gerado a partir de uma fonte de tempo confiável (NTP) e assinado localmente no dispositivo no momento da marcação, para impedir adulteração posterior durante a sincronização. Esse mecanismo é pré-requisito para a marcação valer como prova em fiscalização trabalhista (ver seção 7).
- **Geração de AFD (Arquivo Fonte de Dados)**: o sistema deve gerar o arquivo de dados no formato exigido pela Portaria 671/2021 (MTP) para fins de fiscalização, exportável pelo RH/administrador.
- Integrações necessárias:
  - Sistema de folha de pagamento (para holerite e cálculo de descontos).
  - Sistema de RH/DP já existente (se houver migração parcial em vez de substituição total).
  - Provedor de geolocalização (captura de GPS para fins de auditoria, não bloqueante).
  - Gateway de push notifications.
  - Serviço de OCR/IA para leitura de atestados (ex: extração de CID, CRM, datas).
  - Reembolso/financeiro, para deslocamento e km rodado.
- **Infraestrutura**: app nativo ou híbrido (iOS/Android) + painel web para RH e gestores.
- **Modo offline**: armazenamento local com fila de sincronização, timestamp assinado localmente e resolução de conflitos (ver seção 4.5).
- **Migração de histórico**: plano de migração dos dados históricos de ponto e RH dos sistemas atuais (Solides / Meu RH), preservando integridade dos registros para fins de auditoria retroativa. Decisão de substituição total vs. coexistência temporária a ser definida antes do início da Fase 1.
- **Fallback manual**: procedimento homologado de registro manual de ponto para cenários de indisponibilidade total do sistema, com posterior lançamento retroativo auditável.

## 6. Requisitos Não Funcionais

- **Segurança**: criptografia de dados em trânsito e em repouso, controle de acesso por perfil (RBAC), trilha de auditoria de todas as marcações e aprovações.
- **RBAC granular por dado**: o controle de acesso não é apenas por módulo, mas por campo de dado sensível. Exemplo: CID/médico/CRM de atestados são visíveis apenas ao RH; dados financeiros (holerite) visíveis apenas ao próprio colaborador e ao RH; localização de marcação de ponto visível a gestor e RH, mas não a outros colaboradores.
- **Privacidade / LGPD**: consentimento explícito para dados sensíveis (atestados de saúde), política de retenção e exclusão de dados, minimização de dados coletados. Sem coleta de dado biométrico, a base legal e a superfície de risco de privacidade do produto são significativamente reduzidas.
- **Disponibilidade**: alta disponibilidade do backend (ponto é um sistema crítico — indisponibilidade gera risco trabalhista), com procedimento de fallback manual definido (ver seção 5).
- **Desempenho**: marcação de ponto deve responder em poucos segundos mesmo em conexão instável, e funcionar integralmente offline.
- **Escalabilidade**: suportar crescimento do número de colaboradores e múltiplas unidades/filiais, incluindo parametrização de regras por CNPJ, convenção coletiva e feriados regionais.
- **Acessibilidade**: interface simples para colaboradores não familiarizados com tecnologia. A marcação por botão único (sem etapa biométrica) favorece diretamente esse objetivo.
- **Auditabilidade**: logs completos para fiscalização trabalhista.

## 7. Conformidade Legal (Brasil)

- **Portaria 671/2021 (MTP)**: requisitos para sistemas de ponto eletrônico alternativo (REP-A/REP-P), incluindo geração de AFD para fiscalização (ver seção 5). A marcação de ponto **não pode ser condicionada** à validação de geolocalização — a captura de localização é auxiliar/auditável, nunca um gate de permissão para o colaborador.
- **CLT — cálculo de horas extras, DSR e banco de horas**: as regras de cálculo devem ser parametrizáveis por convenção coletiva/acordo da empresa, incluindo variações por CNPJ e categoria sindical.
- **Intervalo interjornada e intrajornada**: o sistema deve identificar e alertar violações automaticamente.
- **LGPD**: tratamento de dados sensíveis de saúde (atestados/CID) exige base legal específica, consentimento e RBAC granular restringindo o acesso ao RH. Sem reconhecimento facial, o produto não trata dado biométrico, simplificando a base legal exigida.

## 8. Exemplos de Fluxos Críticos

- **Marcação de ponto**: colaborador abre o app → toca em "Bater Ponto" → registro confirmado imediatamente com selo de horário confiável → geolocalização capturada em paralelo para auditoria (sem bloquear a confirmação).
- **Marcação sem sinal de GPS ou rede**: colaborador toca em "Bater Ponto" → app registra localmente com timestamp assinado → confirmação imediata na tela → sincronização automática assim que houver conectividade.
- **Esquecimento de marcação**: sistema identifica ausência de registro de retorno do almoço → push imediato → se não corrigido, novo lembrete no dia seguinte → opção de justificar direto na notificação.
- **Atestado médico**: colaborador fotografa o atestado → IA extrai CID/CRM/dias → RH recebe alerta com os dados completos → aprova ou solicita correção → dias refletidos automaticamente no espelho de ponto → gestor vê apenas "afastamento aprovado, X dias", sem detalhes clínicos.
- **Solicitação de férias**: colaborador solicita período → gestor recebe no feed de aprovações → aprova em 1 clique → RH é notificado para providências formais.
- **Chamado emergencial em sobreaviso**: colaborador ativa "Sobreaviso" → recebe chamado → app detecta início de atendimento → horas de sobreaviso encerram e horas trabalhadas começam a contar automaticamente.

## 9. Indicadores de Sucesso (KPIs)

- Redução no percentual de marcações de ponto pendentes/corrigidas manualmente.
- Tempo médio de aprovação de férias e justificativas.
- Tempo médio de validação de atestados (antes x depois do OCR).
- Número de alertas preventivos que evitaram violações trabalhistas.
- Adoção do app (% de colaboradores ativos mensalmente).
- Satisfação do colaborador (NPS interno) sobre o processo de ponto e RH.

## 10. Roadmap Sugerido

**MVP (Fase 1)**

- Marcação de ponto por botão único (sem biometria), com geolocalização não bloqueante e timestamp confiável (online e offline).
- Espelho de ponto + banco de horas.
- Solicitação de férias e justificativas com aprovação do gestor.
- Upload de documentos e atestados (sem OCR ainda), já com RBAC granular restringindo dados clínicos ao RH.
- Mural de avisos básico.
- Geração de AFD para fiscalização.

**Fase 2**

- OCR/IA para atestados.
- Holerite interativo.
- Portal do gestor com mapa de presença e alertas preventivos.
- Onboarding guiado.

**Fase 3**

- Módulo de plantão/sobreaviso/deslocamento (foco em TI/campo), incluindo resolução de conflitos de sincronização offline.
- Clube de vantagens e matriz de certificações.
- Integrações avançadas (folha de pagamento, reembolso automático).

## 11. Decisões em Aberto

- Substituição total dos sistemas atuais (Solides / Meu RH) vs. coexistência temporária durante a migração.
- Escopo definitivo da geração de AFD: nativa no MVP ou via integração com REP-P homologado existente.
- Stack técnica do app (nativo vs. híbrido) e do painel web.

## 12. Histórico de Revisões

**v2 (atual)**
- Removido reconhecimento facial de todos os fluxos de marcação de ponto.
- Geolocalização deixou de bloquear a marcação; passou a ser registrada apenas para fins de auditoria, com divergências sinalizadas de forma informativa a gestor/RH.
- Adicionado requisito de timestamp confiável (NTP + assinatura local) para marcações online e offline.
- Adicionado requisito explícito de geração de AFD (Portaria 671/2021).
- Adicionado RBAC granular por dado sensível, restringindo CID/médico/CRM ao RH.
- Adicionado procedimento de fallback manual para indisponibilidade do sistema.
- Adicionado requisito de plano de migração de histórico de ponto/RH.
- Adicionada parametrização de regras por CNPJ/convenção coletiva/feriados regionais na escalabilidade.

**v1**
- Versão inicial da especificação funcional.
