import { Callout, InfoPage } from '../components/Info';
import { effectiveDemand } from '../domain/demand';
import { useApp } from '../state';

/** Contas com a equipe cadastrada no momento. */
function SuaEquipe() {
  const { config, employees } = useApp();
  const active = employees.filter((e) => e.active);
  if (active.length === 0) return null;
  const workDays = 7 - config.rules.restDaysPerWeek;
  const demand = effectiveDemand(config, active);
  const rows = (['dia', 'noite'] as const).map((team) => {
    const shifts = config.shifts.filter((s) => s.team === team);
    const people = active.filter((e) => e.team === team).length;
    const need = [0, 1, 2, 3, 4, 5, 6].reduce((acc, wd) => acc + shifts.reduce((a, s) => a + Math.max(demand[wd]?.[s.id]?.min ?? 0, 0), 0), 0);
    return { team, people, capacity: people * workDays, need };
  });
  const total = active.length * workDays;
  return (
    <Callout tone="ok" title={`A sua equipe hoje: ${active.length} funcionários`}>
      <ul className="!mb-0">
        <li>
          No 5x2 a equipe faz <b>{total} turnos por semana</b> ({active.length} × {workDays}).
        </li>
        {rows.map((r) => (
          <li key={r.team}>
            {r.team === 'dia' ? 'Equipe do dia' : 'Madrugada'}: {r.people} pessoas = {r.capacity} turnos por semana
            {r.need > 0 && (
              <>
                {' '}
                (o mínimo configurado pede {r.need}
                {r.capacity < r.need ? <b className="text-red-700"> — não dá para cobrir o mínimo</b> : ''})
              </>
            )}
            .
          </li>
        ))}
        <li>
          Como cada pessoa trabalha {workDays} dos 7 dias, em média ficam <b>{(total / 7).toFixed(1)} pessoas trabalhando por dia</b>, somando
          todos os turnos.
        </li>
      </ul>
    </Callout>
  );
}

function Bands({ rows }: { rows: Array<{ label: string; values: Array<string | number> }> }) {
  const heads = ['06h–14h', '14h–18h', '18h–22h', '22h–06h'];
  return (
    <table>
      <thead>
        <tr>
          <th>Dias</th>
          {heads.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <td>{r.label}</td>
            {r.values.map((v, i) => (
              <td key={i} className="text-center font-semibold">
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Viabilidade24hPage() {
  return (
    <InfoPage
      title="Como manter o posto 24h"
      intro="As contas por trás da escala, as alternativas possíveis e o que muda nas férias. Para consultar sempre que bater a dúvida."
    >
      <SuaEquipe />
      <h2>Exemplo: posto 24h com 13 funcionários</h2>
      <p>
        Para entender a lógica, veja o caso de um posto com 13 funcionários que, na 6x1, trabalhava com 4 pessoas de manhã, 4 à tarde e 2 de
        madrugada.
      </p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Turnos por semana</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Antes (6x1): 4 de manhã + 4 à tarde + 2 de madrugada, todo dia</td>
            <td>10 × 7 = <b>70</b></td>
          </tr>
          <tr>
            <td>Agora (5x2): 13 pessoas × 5 turnos</td>
            <td>
              <b>65</b>
            </td>
          </tr>
          <tr>
            <td>Na média do ano, com férias (cerca de 1 pessoa fora por mês)</td>
            <td>
              <b>≈ 60</b>
            </td>
          </tr>
        </tbody>
      </table>
      <Callout tone="ok" title="Resultado">
        <b>Dá para manter 24h</b>, mas a pista perde de 5 a 10 turnos por semana. A pergunta não é “se”, e sim <b>onde</b> tirar gente. Abaixo
        estão as 3 formas possíveis.
      </Callout>

      <Callout tone="info" title="Como funciona o rodízio de turnos">
        <ul className="!mb-0">
          <li>
            <b>Equipe do dia (manhã e tarde) faz rodízio.</b> Metade fica de manhã enquanto a outra metade fica à tarde, e trocam a cada 2
            semanas. Assim todos fazem manhãs e tardes por igual. Na hora de gerar dá para escolher trocar toda semana ou deixar cada um em
            turno fixo.
          </li>
          <li>
            <b>Manhã → tarde</b> pode a qualquer momento (são 24h de descanso). <b>Tarde → manhã</b> precisa de <b>2 folgas no meio</b>: a lei
            exige 11h entre turnos (tarde→manhã no dia seguinte dá só 8h) e, depois de folga, 24h + 11h = 35h (Súmula 110 do TST). Com 1 folga
            dá 32h; com 2 folgas, 56h.
          </li>
          <li>
            <b>A madrugada tem equipe própria.</b> Se a mesma pessoa alterna entre dia e madrugada, a Justiça pode considerar “turno
            ininterrupto de revezamento”, e aí o limite cai para 6h por dia (CF art. 7º, XIV; OJ 360 do TST). Rodízio só entre manhã e tarde
            não tem esse problema, porque não pega horário noturno. Dá para trocar alguém de equipe de um mês para o outro (por exemplo, para
            cobrir férias).
          </li>
        </ul>
      </Callout>

      <Callout tone="night" title="Por que a madrugada tem 1 hora de intervalo (e o dia, 30 minutos)">
        <p>
          Na madrugada vale a <b>hora noturna reduzida</b>: cada hora entre 22h e 5h conta como 52min30s (CLT art. 73). O turno vai sempre das
          22h às 06h (8h no relógio). Como o intervalo não conta como trabalho, quanto <b>maior</b> o intervalo, <b>menos</b> horas contam:
        </p>
        <table>
          <thead>
            <tr>
              <th>Intervalo na madrugada</th>
              <th>Trabalho real por noite</th>
              <th>Conta como</th>
              <th>5 noites na semana</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>30 minutos</td>
              <td>7h30</td>
              <td>8h34</td>
              <td className="font-semibold text-red-700">42h51 — passa do limite</td>
            </tr>
            <tr>
              <td>1 hora (escolhido)</td>
              <td>7h00</td>
              <td>8h00</td>
              <td className="font-semibold text-emerald-700">40h00 — dentro do limite</td>
            </tr>
          </tbody>
        </table>
        <p className="!mb-0">
          De dia não existe hora reduzida: com 30 minutos de intervalo, 5 turnos dão 37h30 (bem abaixo de 42h). Se um dia quiserem 30 minutos na
          madrugada, é só mudar em <b>Configurações</b>. Vai gerar cerca de 51 minutos de hora extra por semana para cada pessoa da madrugada
          (pagos com 50% + adicional noturno), e o revisor vai avisar.
        </p>
      </Callout>

      <h2>Opção 1 — 5x2 com rodízio (é a que o app faz)</h2>
      <p>
        <b>10 pessoas na equipe do dia (rodízio entre manhã e tarde) e 3 na madrugada.</b> Cada uma trabalha 5 dias por semana.
      </p>
      <Bands
        rows={[
          { label: 'Seg, Qui, Sex, Sáb', values: [4, 4, 4, 2] },
          { label: 'Dom, Ter, Qua', values: [3, 3, 3, 2] },
        ]}
      />
      <ul>
        <li>Manhã e tarde: 25 turnos cada, distribuídos como 4 pessoas em quatro dias e 3 pessoas em três dias.</li>
        <li>Madrugada: sempre 2. Como 3 pessoas fazem 15 noites e só 14 são necessárias, sobra 1 noite por semana com 3 (reforço).</li>
        <li>
          Os dias com 3 pessoas podem ser escolhidos em <b>Configurações → Pessoas por turno</b>. O padrão usa domingo, terça e quarta, mas o
          ideal é usar os dias de menos movimento.
        </li>
      </ul>
      <p>
        <b>A favor:</b> simples, sem hora extra, rodízio justo entre manhã e tarde, e o app faz tudo sozinho. <b>Contra:</b> perde 1 pessoa
        em cada turno em 3 dias da semana.
      </p>

      <h2>Opção 2 — 12x36 para todos</h2>
      <p>
        Dois plantões de 12h: <b>06h–18h</b> e <b>18h–06h</b>. Cada pessoa trabalha um dia e folga o seguinte (cerca de 15 plantões por mês).
        Com 13 pessoas: 8 no dia (4 por plantão), 4 na noite (2 por plantão) e <b>1 folguista</b>.
      </p>
      <Bands rows={[{ label: 'Todos os dias', values: [4, 4, 2, 2] }]} />
      <ul>
        <li>A convenção autoriza a 12x36 (cl. 6.5), e o vale-refeição nesse regime é maior (R$ 41,00 por dia na convenção de SP).</li>
        <li>O domingo de folga a cada 2 semanas sai naturalmente.</li>
        <li>O folguista cobre férias e faltas, o que é a grande vantagem.</li>
      </ul>
      <p>
        <b>A favor:</b> 4 pessoas de dia todos os dias, inclusive domingo, e sobra 1 para cobrir férias. <b>Contra:</b> das 18h às 22h cai de 4
        para 2 pessoas. O plantão de 12h cansa. O plantão da noite fica no limite de 42h por semana (meses de 31 dias passam um pouco) e precisa
        ser reajustado em dezembro de 2027, quando o limite cai para 40h.
      </p>
      <Callout tone="warn">O app ainda não gera escala 12x36. Se a família preferir este modelo, dá para incluir.</Callout>

      <h2>Opção 3 — misto: madrugada em 12x36 e dia em 5x2</h2>
      <p>
        <b>4 pessoas na noite em 12x36 (18h–06h, 2 por plantão)</b> e 9 pessoas de dia no 5x2 (5 de manhã e 4 à tarde).
      </p>
      <Bands
        rows={[
          { label: 'Dias mais fortes', values: [4, 3, '5 (3 + 2)', 2] },
          { label: 'Dias mais fracos', values: [3, 2, '4 (2 + 2)', 2] },
        ]}
      />
      <p>
        <b>A favor:</b> o fim da tarde (18h–22h) fica mais forte, com a turma da noite chegando às 18h. <b>Contra:</b> a tarde (14h–18h) fica com
        2 ou 3 pessoas, são dois regimes diferentes para controlar, e a noite tem o mesmo problema de horas da opção 2.
      </p>

      <h2>Comparando</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Opção 1 (5x2)</th>
            <th>Opção 2 (12x36)</th>
            <th>Opção 3 (misto)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Manhã</td>
            <td>3–4</td>
            <td>4</td>
            <td>3–4</td>
          </tr>
          <tr>
            <td>Tarde até 18h</td>
            <td>3–4</td>
            <td>4</td>
            <td>2–3</td>
          </tr>
          <tr>
            <td>18h–22h</td>
            <td>3–4</td>
            <td>2</td>
            <td>4–5</td>
          </tr>
          <tr>
            <td>Madrugada</td>
            <td>2 (às vezes 3)</td>
            <td>2</td>
            <td>2</td>
          </tr>
          <tr>
            <td>Cobertura de férias</td>
            <td>Difícil</td>
            <td>
              <b>Boa (folguista)</b>
            </td>
            <td>Difícil</td>
          </tr>
          <tr>
            <td>Hora extra</td>
            <td>
              <b>Nenhuma</b>
            </td>
            <td>Pode ter na noite</td>
            <td>Pode ter na noite</td>
          </tr>
          <tr>
            <td>Feito pelo app</td>
            <td>
              <b>Sim</b>
            </td>
            <td>Ainda não</td>
            <td>Ainda não</td>
          </tr>
        </tbody>
      </table>

      <h2>E nas férias?</h2>
      <p>
        Cada funcionário tem 30 dias de férias por ano. Com 13 pessoas, em média sempre tem cerca de 1 de férias. Tudo sobre férias está
        explicado na aba <a href="/ferias">Férias</a>. Resumindo, na Opção 1:
      </p>
      <ul>
        <li>
          <b>Alguém do dia de férias:</b> a equipe do dia fica com 9 pessoas, que fazem 45 turnos em vez de 50. Alguns dias ficam com 3
          pessoas onde seriam 4. O gerador distribui sozinho.
        </li>
        <li>
          <b>Alguém da madrugada de férias:</b> sobram 2 pessoas, que fazem só 10 das 14 noites. <b>Não dá para manter 2 toda noite.</b> Solução:
          escolher uma pessoa do dia para cobrir a madrugada naquele mês inteiro. Em <b>Funcionários</b>, troque a equipe dela para
          Madrugada antes de gerar a escala do mês, e volte depois.
        </li>
        <li>
          <b>Dicas:</b> nunca coloque duas pessoas do mesmo turno de férias no mesmo mês. Se possível, faça as férias começarem no dia 1º e
          terminarem no fim do mês, porque isso facilita muito a escala.
        </li>
      </ul>

      <h2>E quando alguém falta ou pega atestado?</h2>
      <p>
        Cadastre o atestado em <b>Funcionários</b> e clique em <b>Gerar de novo</b> na escala. Os dias que já passaram ficam como estão, e o
        gerador refaz só o restante do mês, respeitando todas as regras. Se ainda assim faltar gente, o revisor mostra exatamente onde.
      </p>

      <Callout tone="warn" title="O que não dá para fazer">
        Não dá para manter 4 + 4 + 2 todos os dias com 13 pessoas no 5x2. Para isso seriam necessárias 14 pessoas (70 ÷ 5), mais uma para
        cobrir férias.
      </Callout>
    </InfoPage>
  );
}
