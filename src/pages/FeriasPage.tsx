import { Link } from 'react-router-dom';
import { Callout, Faq, InfoPage, Sources } from '../components/Info';

export default function FeriasPage() {
  return (
    <InfoPage title="Férias" intro="Tudo o que envolve férias: as regras da lei, como elas mexem na escala e como cadastrar no app.">
      <Callout tone="ok" title="Resumo em 5 linhas">
        <ul className="!mb-0">
          <li>Cada funcionário tem <b>30 dias de férias</b> a cada 12 meses de trabalho.</li>
          <li>
            A empresa tem <b>os 12 meses seguintes</b> para dar as férias. Se passar desse prazo, paga <b>em dobro</b>.
          </li>
          <li>
            Avisar por escrito <b>30 dias antes</b> e pagar (salário + 1/3) até <b>2 dias antes</b> de começar.
          </li>
          <li>Pode dividir em até 3 partes: uma com pelo menos 14 dias e as outras com pelo menos 5.</li>
          <li>
            Na escala: <b>uma pessoa de férias por vez em cada equipe</b>. Férias de alguém da madrugada pedem que alguém do dia cubra a
            madrugada naquele mês.
          </li>
        </ul>
      </Callout>

      <h2>As regras das férias</h2>
      <table>
        <thead>
          <tr>
            <th>Assunto</th>
            <th>Como funciona</th>
            <th>Base</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Quanto tempo</td>
            <td>
              30 dias corridos a cada 12 meses de trabalho (o “período aquisitivo”). Faltas sem justificativa diminuem as férias: de 6 a 14
              faltas → 24 dias; de 15 a 23 → 18 dias; de 24 a 32 → 12 dias; mais de 32 → perde as férias daquele período.
            </td>
            <td>CLT art. 130</td>
          </tr>
          <tr>
            <td>Prazo para dar</td>
            <td>
              Nos 12 meses depois do período aquisitivo (o “período concessivo”). Se passar do prazo, a empresa paga as férias <b>em dobro</b>.
            </td>
            <td>CLT arts. 134 e 137</td>
          </tr>
          <tr>
            <td>Quem escolhe a data</td>
            <td>A empresa escolhe a época que for melhor para o posto. O ideal é combinar com o funcionário.</td>
            <td>CLT art. 136</td>
          </tr>
          <tr>
            <td>Aviso</td>
            <td>Por escrito, com pelo menos 30 dias de antecedência. O funcionário assina o recebimento.</td>
            <td>CLT art. 135</td>
          </tr>
          <tr>
            <td>Pagamento</td>
            <td>
              Salário das férias + 1/3, pago até 2 dias antes de começar. Se atrasar, a convenção prevê multa de 10% do salário para o
              funcionário.
            </td>
            <td>CF art. 7º, XVII; CLT art. 145; convenção cl. 14.1</td>
          </tr>
          <tr>
            <td>Dividir as férias</td>
            <td>
              Só se o funcionário concordar. No máximo 3 partes: uma com pelo menos 14 dias corridos e as outras com pelo menos 5 dias cada.
            </td>
            <td>CLT art. 134 §1º</td>
          </tr>
          <tr>
            <td>Dia de começar</td>
            <td>
              As férias <b>não podem começar nos 2 dias antes de um feriado ou da folga semanal</b>. Na prática, comece as férias no dia
              seguinte a uma folga ou a um feriado.
            </td>
            <td>CLT art. 134 §3º</td>
          </tr>
          <tr>
            <td>Vender 10 dias (abono)</td>
            <td>
              O funcionário pode pedir para “vender” 1/3 das férias (10 dias). Ele trabalha esses dias e recebe a mais. O pedido é feito até 15
              dias antes de terminar o período aquisitivo. No app, cadastre só os 20 dias de descanso.
            </td>
            <td>CLT art. 143</td>
          </tr>
          <tr>
            <td>Cesta básica</td>
            <td>Continua sendo dada durante as férias.</td>
            <td>Convenção cl. 22.2</td>
          </tr>
        </tbody>
      </table>

      <h2>Como as férias mexem na escala</h2>
      <p>
        No 5x2 cada pessoa faz 5 turnos por semana. Quando alguém sai de férias, a equipe perde esses 5 turnos. Veja o que acontece em cada
        caso:
      </p>
      <table>
        <thead>
          <tr>
            <th>Situação</th>
            <th>Turnos por semana</th>
            <th>O que acontece</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Ninguém de férias</td>
            <td>Exemplo com 10 no dia e 3 na madrugada: 50 · 15</td>
            <td>Escala normal: manhã e tarde com 3 ou 4 pessoas, madrugada sempre com 2.</td>
          </tr>
          <tr>
            <td>1 pessoa do dia de férias</td>
            <td>Dia: 45</td>
            <td>
              Faltam 5 turnos por semana. Alguns dias ficam com 3 pessoas onde seriam 4. <b>Dá para fazer.</b>
            </td>
          </tr>
          <tr>
            <td>2 pessoas do dia de férias juntas</td>
            <td>Dia: 40</td>
            <td>Faltam 10 turnos por semana. Muitos dias com 3 pessoas, alguns com 2. Evite.</td>
          </tr>
          <tr>
            <td>1 pessoa da madrugada de férias</td>
            <td>Madrugada: 10 (precisa de 14)</td>
            <td>
              <b>Não fecha:</b> sobram 2 pessoas, que só cobrem 10 das 14 noites. É preciso passar alguém do dia para a madrugada naquele mês (o
              dia fica com 9 pessoas).
            </td>
          </tr>
        </tbody>
      </table>

      <Callout tone="night" title="Férias de alguém da madrugada: passo a passo">
        <ol className="!mb-0">
          <li>Escolha uma pessoa da equipe do dia que aceite fazer a madrugada durante aquele mês.</li>
          <li>
            Em <b>Funcionários</b>, abra essa pessoa e troque a equipe para <b>Equipe da madrugada</b>.
          </li>
          <li>
            Gere a escala do mês. O gerador já respeita o descanso na troca: quem sai da tarde só começa na madrugada com o descanso certo.
          </li>
          <li>
            Antes de gerar o mês seguinte, volte a pessoa para a <b>Equipe do dia</b>. Na volta, ela precisa de 2 folgas antes de entrar de
            manhã ou à tarde, e o gerador já cuida disso.
          </li>
        </ol>
      </Callout>

      <h2>Como cadastrar no app</h2>
      <ol>
        <li>
          Vá em <Link to="/funcionarios">Funcionários</Link> e clique no nome da pessoa.
        </li>
        <li>
          Em “Férias, atestados e afastamentos”, escolha <b>Férias</b>, preencha o <b>primeiro</b> e o <b>último dia</b> e clique em{' '}
          <b>Adicionar</b>. O app mostra quantos dias deu.
        </li>
        <li>
          Clique em <b>Salvar</b>.
        </li>
        <li>
          Vá em <Link to="/escala">Escala do mês</Link> e gere a escala. Nos dias de férias aparece <b>FÉR</b> em cinza, e a pessoa não é
          escalada.
        </li>
      </ol>
      <p>O revisor confere sozinho:</p>
      <ul>
        <li>férias com menos de 5 dias;</li>
        <li>férias começando a 1 ou 2 dias de um feriado;</li>
        <li>madrugada sem gente suficiente por causa de férias;</li>
        <li>duas pessoas da equipe do dia de férias ao mesmo tempo;</li>
        <li>alguém escalado num dia em que está de férias.</li>
      </ul>

      <h2>Dicas para planejar o ano</h2>
      <ul>
        <li>
          Faça um calendário do ano com <b>uma pessoa de férias por vez em cada equipe</b>, espalhando as férias pelos 12 meses.
        </li>
        <li>Coloque as férias da madrugada nos meses em que alguém do dia aceite fazer a noite.</li>
        <li>Prefira os meses de menos movimento para as férias.</li>
        <li>
          Cadastre as férias <b>antes</b> de gerar a escala do mês, porque assim o gerador já distribui as folgas em volta delas.
        </li>
        <li>Não deixe vencer o período concessivo. Férias vencidas custam o dobro.</li>
      </ul>

      <h2>Perguntas comuns</h2>
      <div className="space-y-2">
        <Faq q="Os dias de férias contam como folga da semana?">
          <p>Não. Férias são férias. As folgas do 5x2 valem para as semanas em que a pessoa trabalha.</p>
        </Faq>
        <Faq q="O funcionário pegou atestado no meio do mês. E agora?">
          <p>
            Cadastre o atestado (tipo “Atestado”) com o primeiro e o último dia e clique em <b>Gerar de novo</b> na escala. Os dias que já
            passaram não mudam. O gerador refaz só o restante do mês.
          </p>
        </Faq>
        <Faq q="Feriado durante as férias aumenta as férias?">
          <p>Não. As férias são contadas em dias corridos, incluindo feriados e domingos.</p>
        </Faq>
        <Faq q="Posso mandar duas pessoas de férias juntas?">
          <p>
            Pela lei, pode. Mas, com equipe enxuta, a escala fica bem apertada (veja a tabela acima). O revisor avisa quando isso acontece.
          </p>
        </Faq>
      </div>

      <Sources
        items={[
          ['CLT — Decreto-Lei 5.452/1943 (arts. 129 a 145, férias)', 'https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm'],
          ['Convenção Coletiva 2026-2028 (Sincopetro × Fepospetro)', 'https://sincopetro.org.br/convencao-coletiva-de-trabalho/'],
        ]}
      />
    </InfoPage>
  );
}
