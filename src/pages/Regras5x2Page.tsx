import { Callout, InfoPage, Sources } from '../components/Info';

export default function Regras5x2Page() {
  return (
    <InfoPage
      title="Regras do 5x2"
      intro="Resumo do que mudou com o fim da escala 6x1 e do que vale para o posto. Linguagem simples, com a base legal de cada ponto."
    >
      <Callout tone="ok" title="Em uma frase">
        A partir de <b>16 de dezembro de 2026</b>, cada funcionário trabalha no máximo <b>42 horas por semana</b>, com <b>2 folgas por
        semana</b>, sem diminuir o salário. Em <b>16 de dezembro de 2027</b> o limite cai para <b>40 horas</b>.
      </Callout>

      <h2>As normas</h2>
      <table>
        <thead>
          <tr>
            <th>Norma</th>
            <th>O que é</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <b>Emenda Constitucional nº 141/2026</b>
            </td>
            <td>Promulgada em 16/10/2026. Acaba com a 6x1, garante 2 dias de descanso por semana e reduz a jornada.</td>
          </tr>
          <tr>
            <td>
              <b>Decreto nº 13.173/2026</b>
            </td>
            <td>Regulamenta a emenda.</td>
          </tr>
          <tr>
            <td>
              <b>Portaria MTE nº 2.041/2026</b>
            </td>
            <td>Publicada em 23/11/2026. Regras práticas: folgas, domingos, 12x36, cálculo do salário-hora.</td>
          </tr>
          <tr>
            <td>
              <b>Liminar do STF (min. Flávio Dino, 12/11/2026)</b>
            </td>
            <td>Decisão provisória que deixou a transição mais flexível. O plenário ainda vai julgar.</td>
          </tr>
          <tr>
            <td>
              <b>Convenção Coletiva 2026-2028</b>
            </td>
            <td>
              Acordo entre os sindicatos dos frentistas (Fepospetro e sindicatos regionais) e o sindicato dos postos (Sincopetro). Vale para
              os postos do Estado de São Paulo nas bases dos sindicatos que assinaram. Cláusulas sociais até 28/02/2028. Em outros estados,
              confira a convenção local.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Cronograma</h2>
      <table>
        <thead>
          <tr>
            <th>Período</th>
            <th>Máximo por semana</th>
            <th>Folgas</th>
            <th>Divisor do salário-hora</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Até 15/12/2026</td>
            <td>44h (regra antiga)</td>
            <td>1 por semana</td>
            <td>220</td>
          </tr>
          <tr>
            <td>
              <b>De 16/12/2026</b>
            </td>
            <td>
              <b>42h</b>, até 8h por dia
            </td>
            <td>
              <b>2 por semana</b>
            </td>
            <td>210</td>
          </tr>
          <tr>
            <td>De 16/12/2027</td>
            <td>
              <b>40h</b>
            </td>
            <td>2 por semana</td>
            <td>200</td>
          </tr>
        </tbody>
      </table>
      <p>
        O <b>divisor</b> é o número pelo qual o salário mensal é dividido para achar o valor da hora (usado em hora extra e adicional
        noturno). Como ele cai, o valor da hora sobe — o salário do mês continua o mesmo.
      </p>

      <h2>As regras que a escala precisa seguir</h2>
      <h3>1. Duas folgas por semana</h3>
      <ul>
        <li>A semana vai de <b>segunda a domingo</b>. Em cada uma, no máximo 5 dias de trabalho.</li>
        <li>Cada folga tem 24 horas seguidas. Podem ser emendadas ou separadas.</li>
        <li>
          Pela lei, ninguém pode trabalhar mais de 6 dias seguidos. <b>O app é mais rígido:</b> no máximo 5 dias seguidos e 2 folgas também
          contando de domingo a sábado.
        </li>
        <li>
          Espalhar as folgas pelo mês (média de 2 por semana) só é permitido com acordo ou convenção coletiva que autorize — a convenção do
          posto não prevê isso. Por isso o app usa a regra semanal.
        </li>
      </ul>
      <h3>2. Descanso entre um turno e outro</h3>
      <ul>
        <li>
          Pelo menos <b>11 horas</b> entre o fim de um turno e o começo do próximo (CLT art. 66).
        </li>
        <li>
          Depois de folga, o descanso total precisa ser de pelo menos <b>24h da folga + 11h = 35h</b> (Súmula 110 do TST). Por isso, quem sai
          da tarde (22h) só pode voltar de manhã (06h) depois de 2 folgas.
        </li>
      </ul>
      <h3>3. Domingo</h3>
      <ul>
        <li>Posto pode abrir aos domingos, com escala de revezamento mensal (a fiscalização pode pedir).</li>
        <li>
          <b>Homens:</b> folga no domingo pelo menos <b>a cada 3 semanas</b> — depois de 2 domingos trabalhados, o 3º é obrigatoriamente
          folga (convenção cl. 6.2 e Lei 10.101/2000 art. 6º).
        </li>
        <li>
          <b>Mulheres:</b> folga no domingo <b>a cada 2 semanas</b> (CLT art. 386, confirmado pelo STF no RE 1403904; convenção cl. 6.2.1).
        </li>
        <li>
          <b>Licença-maternidade:</b> 120 dias (CF art. 7º, XVIII; CLT art. 392), ou 180 se o posto aderir ao Empresa Cidadã. No cadastro da
          funcionária, use o tipo “Licença-maternidade” nas ausências: ela sai da escala nesse período.
        </li>
      </ul>
      <h3>4. Feriados</h3>
      <ul>
        <li>
          Feriado trabalhado é <b>pago em dobro</b> e <b>não pode ser trocado por folga</b> (convenção cl. 6.4). Hora extra em feriado: 100%
          (cl. 7.2).
        </li>
      </ul>
      <h3>5. Intervalo</h3>
      <ul>
        <li>Turno de mais de 6h tem intervalo para refeição de 1 a 2 horas (CLT art. 71) — é o padrão do app. A convenção permite reduzir para no mínimo 30 minutos (cl. 6.4.1).</li>
        <li>O intervalo não conta como hora trabalhada.</li>
      </ul>
      <h3>6. Hora noturna</h3>
      <ul>
        <li>
          Entre 22h e 5h, cada hora conta como <b>52min30s</b> (CLT art. 73). Na prática, 7h de relógio na madrugada valem 8h de jornada.
        </li>
        <li>Quem faz a madrugada inteira e continua depois das 5h: essas horas também contam como noturnas (Súmula 60 do TST).</li>
        <li>Adicional noturno: 25% na convenção de SP.</li>
      </ul>
      <h3>7. Banco de horas e 12x36</h3>
      <ul>
        <li>Banco de horas só com acordo coletivo específico com o sindicato (convenção cl. 8).</li>
        <li>A 12x36 é autorizada pela convenção (cl. 6.5). Se a média do mês passar do limite semanal, a diferença é compensada ou paga.</li>
      </ul>
      <h3>8. Salário</h3>
      <ul>
        <li>Não pode diminuir, nem o piso da categoria.</li>
        <li>Quem faz frentista e caixa ao mesmo tempo recebe +20% (convenção cl. 10). Periculosidade: 30% (cl. 12.1).</li>
      </ul>

      <h2>O que a liminar do STF mudou (vale até o julgamento final)</h2>
      <ul>
        <li>A data de 16/12/2026 foi mantida. O pedido de adiamento das confederações (CNI e CNC) foi negado.</li>
        <li>Sem acordo coletivo, as 42h podem ser divididas em 5 dias de até 8h24, sem hora extra pelos 24 minutos.</li>
        <li>As folgas podem ser adiadas, mas nunca tiradas. Em caso excepcional, a 2ª folga suprimida deve ser compensada no mesmo mês.</li>
        <li>A CNI entrou com nova ação em 24/11/2026. As regras ainda podem mudar — por isso tudo no app é ajustável em Configurações.</li>
      </ul>

      <h2>Fiscalização</h2>
      <ul>
        <li>Nos primeiros 90 dias (a partir de 16/12/2026) o fiscal faz “dupla visita”: primeiro orienta, depois multa.</li>
        <li>Mesmo assim, o funcionário pode cobrar na Justiça desde o primeiro dia. Por isso o revisor do app bloqueia escalas com erro.</li>
      </ul>

      <Callout tone="warn" title="Importante">
        Este resumo foi feito a partir de fontes oficiais e da convenção coletiva, mas não substitui o contador ou um advogado trabalhista.
      </Callout>

      <Sources
        items={[
          ['Ministério do Trabalho — portaria com regras complementares da escala 5x2', 'https://www.gov.br/trabalho-e-emprego/pt-br/noticias-e-conteudo/2026/novembro/governo-federal-publica-portaria-com-regras-complementares-para-aplicacao-da-escala-5x2'],
          ['Agência Brasil — Congresso promulga emenda do fim da 6x1', 'https://agenciabrasil.ebc.com.br/politica/noticia/2026-10/congresso-promulga-emenda-do-fim-da-6x1-escala-5x2-comeca-em-60-dias'],
          ['Senado Verifica — transição gradual sem redução salarial', 'https://www12.senado.leg.br/verifica/materias-especiais/2026/escala-5x2-tera-transicao-gradual-sem-reducao-salarial'],
          ['Migalhas — regras complementares da escala 5x2', 'https://www.migalhas.com.br/quentes/469133/governo-publica-regras-complementares-para-aplicacao-da-escala-5x2'],
          ['Metrópoles — liminar de Flávio Dino sobre as folgas', 'https://www.metropoles.com/brasil/escala-5x2-folgas-podem-ser-adiadas-mas-nao-negadas-diz-decisao-de-dino'],
          ['Migalhas — nova ação da CNI no STF', 'https://www.migalhas.com.br/quentes/469230/cni-ajuiza-nova-acao-no-stf-contra-regras-da-escala-5x2'],
          ['Convenção Coletiva 2026-2028 (Sincopetro × Fepospetro)', 'https://sincopetro.org.br/convencao-coletiva-de-trabalho/'],
          ['Federação dos frentistas de SP — sindicatos e bases', 'https://www.federacaodosfrentistassp.org.br/sindicatos'],
          ['Lei 10.101/2000 (domingos no comércio)', 'https://www.planalto.gov.br/ccivil_03/leis/l10101.htm'],
        ]}
      />
    </InfoPage>
  );
}
