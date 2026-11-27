# EscalApp

Aplicação web para montar a escala de trabalho de um posto de combustível 24h no regime **5x2**
(fim da escala 6x1 — EC 141/2026, Portaria MTE 2.041/2026), respeitando a CLT e a Convenção Coletiva
2026-2028 dos frentistas de SP (Sincopetro × Fepospetro).

## O que faz

- **Gera a escala do mês automaticamente** com um otimizador (programação inteira, [HiGHS](https://highs.dev)
  compilado para WebAssembly). Roda inteiro no navegador: sem servidor e sem inteligência artificial.
- **Revisor legal**: confere a escala a cada mudança (inclusive as manuais) e bloqueia a exportação se houver erro.
- **Exporta** para impressão/PDF e imagem (para enviar no WhatsApp).
- **Configurável por posto**: movimento de cada dia, restrições entre funcionários, rodízio ou turno fixo, regras.
- **Abas informativas**: regras do 5x2, como manter o posto 24h, férias e dúvidas.

### Regras verificadas

| Regra | Base |
| --- | --- |
| 2 folgas por semana (segunda a domingo), máx. 42h/semana (40h a partir de 16/12/2027) | EC 141/2026; Portaria MTE 2.041/2026 |
| 11h entre jornadas; após folga, 24h + 11h | CLT art. 66 e 67; Súmula 110 TST |
| Máx. 5 dias seguidos e 2 folgas também de domingo a sábado (padrão do app; a lei permite 6) | CLT art. 67; OJ 410 SDI-1 |
| Folga no domingo a cada 3 semanas (mulheres: 2) | Lei 10.101/2000 art. 6º; CLT art. 386; CCT cl. 6.2 / 6.2.1 |
| Hora noturna reduzida (52min30s) e prorrogação | CLT art. 73; Súmula 60 TST |
| Não misturar dia e madrugada (turno ininterrupto) | CF art. 7º, XIV; OJ 360 SDI-1 |
| Feriado trabalhado em dobro, sem compensação | CCT cl. 6.4 |
| Cobertura mínima/ideal por turno (madrugada ≥ 2) | Configuração do posto |

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # testes do motor (horas, gerador e revisor)
npm run build
```

Sem as variáveis do Firebase o site roda em **modo local** (dados guardados só no navegador) — útil para testar.

## Configurar o Firebase (banco de dados + login)

1. Acesse <https://console.firebase.google.com> e crie um projeto (pode desativar o Google Analytics).
2. **Authentication** → Começar → Método de login → ative **Google**.
3. **Firestore Database** → Criar banco de dados → modo de produção → região `southamerica-east1` (São Paulo).
4. As regras de segurança ([`firestore.rules`](firestore.rules)) são publicadas junto com o site pelo
   `npm run deploy` (não precisa colocar e-mail nenhum).
5. **Configurações do projeto** → Seus apps → adicione um app **Web** (`</>`) e copie os valores do `firebaseConfig`.
6. Copie `.env.example` para `.env.local` e preencha.
7. Se usar um domínio próprio, adicione-o em **Authentication → Configurações → Domínios autorizados**
   (`*.web.app` e `*.firebaseapp.com` já vêm liberados).

O plano gratuito (Spark) é mais que suficiente e não desliga por falta de uso.

### Contas e acesso

- Cada conta do Google que entra pela primeira vez ganha **o próprio posto** (dados separados) e vira **dono**.
- O dono libera outros e-mails em **Configurações → Posto e acesso**; quem for liberado entra com a própria conta
  do Google e vê a mesma escala. Quem tem acesso a mais de um posto troca pelo seletor no topo.

## Publicar (Firebase Hosting)

O site fica em <https://escala-posto-80784.web.app>.

**Automático:** cada `git push` na branch `main` roda os testes e, se passarem, publica o site
([`.github/workflows/firebase-hosting-merge.yml`](.github/workflows/firebase-hosting-merge.yml)). O andamento
aparece na aba **Actions** do GitHub. O GitHub precisa dos segredos `VITE_FIREBASE_*` (mesmos valores do `.env.local`):

```bash
gh secret set -f .env.local
```

**Manual** (também publica as regras do banco, que o automático não publica):

```bash
npx firebase login   # só na primeira vez (no PowerShell: npx.cmd firebase login)
npm run deploy       # gera o site com o .env.local e publica site + regras do banco
```

O projeto usado está em [`.firebaserc`](.firebaserc); rotas, cache e regras em [`firebase.json`](firebase.json).

## Estrutura

```
src/
  domain/         regras de negócio (sem React)
    hours.ts        cálculo de horas (hora noturna, intervalo)
    solver.ts       gerador da escala (modelo de otimização)
    validator.ts    revisor (regras legais e de cobertura)
    context.ts      dados do mês + histórico do mês anterior
    defaults.ts     turnos, demanda e regras padrão
    holidays.ts     feriados nacionais e de SP
  data/           persistência (Firebase ou navegador)
  pages/          telas e abas informativas
  components/     grade da escala, lista de problemas etc.
```

> As informações legais foram pesquisadas em novembro de 2026 e podem mudar (há ações no STF).
> Não substituem a orientação de um contador ou advogado trabalhista.
