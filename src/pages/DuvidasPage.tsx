import { Link } from 'react-router-dom';
import { Faq, InfoPage } from '../components/Info';

export default function DuvidasPage() {
  return (
    <InfoPage title="Dúvidas frequentes" intro="Explicações rápidas sobre as regras da escala e sobre como usar o app.">
      <h2>Usando o app</h2>
      <div className="space-y-2">
        <Faq q="Qual é o passo a passo para fazer a escala do mês?">
          <ul>
            <li>
              Em <Link to="/funcionarios">Funcionários</Link>: confira os nomes, a equipe de cada um (dia ou madrugada), quem é mulher, e cadastre férias e
              atestados do mês.
            </li>
            <li>
              Em <Link to="/escala">Escala do mês</Link>: escolha o mês e clique em <b>Gerar escala automática</b>.
            </li>
            <li>Ajuste o que quiser clicando nas células. O revisor, ao lado, mostra na hora se alguma regra foi quebrada.</li>
            <li>
              Clique em <b>Revisar e exportar</b>. Se estiver tudo certo, abre a folha para imprimir, salvar em PDF ou baixar a imagem para o
              WhatsApp.
            </li>
          </ul>
        </Faq>
        <Faq q="O que significa o cadeado 🔒?">
          <p>
            Célula travada: o gerador não mexe nela quando você clica em “Gerar de novo”. Toda mudança feita à mão é travada automaticamente,
            para não ser perdida. Para liberar, clique na célula e escolha “Destravar”, ou use “Destravar tudo”.
          </p>
        </Faq>
        <Faq q="Erro, Atenção e Aviso: qual a diferença?">
          <ul>
            <li>
              <b>Erro (vermelho):</b> quebra a lei ou a convenção. A exportação fica bloqueada até corrigir.
            </li>
            <li>
              <b>Atenção (laranja):</b> problema sério de operação, como a madrugada com menos de 2 pessoas. Dá para exportar, mas é preciso
              confirmar.
            </li>
            <li>
              <b>Aviso (azul):</b> informação importante, como feriado trabalhado (pagar em dobro), hora extra prevista ou turno abaixo do
              ideal.
            </li>
          </ul>
        </Faq>
        <Faq q="Por que o app pede o mês anterior?">
          <p>
            A semana da virada do mês, os dias seguidos de trabalho e a sequência de domingos dependem do que aconteceu no fim do mês anterior.
            Se o mês anterior estiver no app, o gerador e o revisor levam isso em conta. No primeiro mês de uso, confira os primeiros dias com
            atenção.
          </p>
        </Faq>
        <Faq q="Gerei de novo no meio do mês. O que acontece com os dias que já passaram?">
          <p>
            Ficam como estão. No mês atual, o gerador só refaz os dias de hoje em diante (e respeita as células travadas).
          </p>
        </Faq>
        <Faq q="Dois funcionários querem trocar a folga entre si. Como faço?">
          <p>
            Clique nas células e troque à mão. O revisor confere na hora se a troca quebrou alguma regra, por exemplo 7 dias seguidos ou 3
            domingos trabalhados.
          </p>
        </Faq>
        <Faq q="Os dados ficam salvos onde?">
          <p>
            Na nuvem (Firebase, do Google), na conta autorizada. Dá para abrir a escala em qualquer computador ou celular, entrando com a mesma
            conta.
          </p>
        </Faq>
      </div>

      <h2>Regras</h2>
      <div className="space-y-2">
        <Faq q="Alguém pode trabalhar 6 dias seguidos?">
          <p>
            Pela lei, a semana do 5x2 vai de <b>segunda a domingo</b>, e o limite é de 6 dias seguidos (a folga não pode passar do 7º dia).
            Então, contando de domingo a sábado, alguém podia aparecer com uma folga só, mesmo estando tudo certo de segunda a domingo.
          </p>
          <p>
            Para não ter dúvida, o app é mais rígido que a lei: <b>no máximo 5 dias seguidos</b> e <b>2 folgas em qualquer semana</b>,
            contando de segunda a domingo <b>e também</b> de domingo a sábado. Dá para mudar em Configurações, mas não recomendamos.
          </p>
        </Faq>
        <Faq q="Rodízio ou turno fixo: onde escolho?">
          <p>
            Ao clicar em <b>Gerar escala</b>, abre uma janela para escolher: rodízio a cada 2 semanas (recomendado), rodízio toda semana,
            turno fixo (cada um sempre no mesmo turno) ou livre. A escolha fica salva para os próximos meses.
          </p>
        </Faq>
        <Faq q="Como funciona o rodízio entre manhã e tarde?">
          <p>
            A equipe do dia alterna entre manhã e tarde. Metade fica de manhã enquanto a outra metade fica à tarde, e trocam a cada 2 semanas
            (dá para mudar para toda semana em Configurações). Da manhã para a tarde pode trocar a qualquer momento. Da tarde para a manhã, só com <b>2 folgas no meio</b>, porque a lei exige 11h entre turnos e,
            depois de uma folga, 24h + 11h = 35h de descanso (Súmula 110 do TST). Com 1 folga só daria 32h.
          </p>
          <p>Se alguém só pode trabalhar num turno (por exemplo, porque estuda), marque “Só manhã” ou “Só tarde” no cadastro.</p>
        </Faq>
        <Faq q="Por que a madrugada não entra no rodízio?">
          <p>
            Se a mesma pessoa alterna entre dia e madrugada, a Justiça pode considerar “turno ininterrupto de revezamento”, e nesse caso o
            limite cai para <b>6 horas por dia</b> (CF art. 7º, XIV; OJ 360 do TST). A convenção do posto não autoriza 8h nesse regime. Rodízio
            só entre manhã e tarde não tem esse risco. Dá para trocar alguém de equipe de um mês para o outro, por exemplo para cobrir férias
            da madrugada.
          </p>
        </Faq>
        <Faq q="De quanto em quanto tempo o funcionário precisa folgar no domingo?">
          <ul>
            <li>
              <b>Homens:</b> pelo menos a cada 3 semanas. Depois de 2 domingos trabalhados, o 3º é folga (convenção cl. 6.2).
            </li>
            <li>
              <b>Mulheres:</b> a cada 2 semanas (CLT art. 386; convenção cl. 6.2.1). Por isso existe a opção “Mulher” no cadastro.
            </li>
          </ul>
        </Faq>
        <Faq q="E se alguém trabalhar no feriado?">
          <p>
            Recebe o dia em dobro. Pela convenção (cl. 6.4), <b>não dá para compensar com folga</b>: tem que pagar. O revisor lista os feriados
            trabalhados para lembrar a folha de pagamento. Os feriados municipais da sua cidade precisam ser cadastrados em
            Configurações.
          </p>
        </Faq>
        <Faq q="Por que a madrugada tem 1 hora de intervalo e o dia só 30 minutos?">
          <p>
            Por causa da hora noturna reduzida (cada hora entre 22h e 5h conta 52min30s). Com 30 minutos de intervalo, a madrugada conta 8h34
            por noite e passa de 42h na semana. Com 1h, conta 8h00 e fica em 40h, sem hora extra. Veja a explicação completa em{' '}
            <Link to="/como-manter-24h">Como manter 24h</Link>.
          </p>
        </Faq>
        <Faq q="O que muda em dezembro de 2027?">
          <p>
            O limite semanal cai de 42h para 40h, e o app troca o limite sozinho. Com os turnos atuais (37h30 de dia e 40h na madrugada), a
            escala continua dentro da regra.
          </p>
        </Faq>
        <Faq q="Pode trabalhar 8h24 por dia?">
          <p>
            A liminar do STF permite dividir as 42h em 5 dias de até 8h24 sem hora extra. O posto não precisa disso: os turnos de 8h (com
            intervalo) já cabem no limite.
          </p>
        </Faq>
        <Faq q="Como funcionam as férias?">
          <p>
            Tem uma aba só para isso: <Link to="/ferias">Férias</Link>. Lá estão as regras da lei, como as férias mexem na escala e o passo a
            passo para cadastrar.
          </p>
        </Faq>
        <Faq q="O funcionário pode trabalhar 6 dias numa semana para compensar?">
          <p>
            Não. A convenção só permite banco de horas com acordo coletivo específico com o sindicato (cl. 8), e o posto não tem. Pela regra
            geral, são 2 folgas em toda semana, de segunda a domingo.
          </p>
        </Faq>
        <Faq q="O salário muda?">
          <p>
            Não pode diminuir. O que muda é o valor da hora (o salário passa a ser dividido por 210 e, em 2027, por 200), que é usado para
            calcular hora extra e adicional noturno. Quem faz frentista e caixa ao mesmo tempo continua com +20% (convenção cl. 10).
          </p>
        </Faq>
        <Faq q="Quem confirma tudo isso?">
          <p>
            As regras vêm da Emenda Constitucional 141/2026, da Portaria MTE 2.041/2026, da CLT e da Convenção Coletiva 2026-2028 dos
            frentistas de SP. Tudo está detalhado em <Link to="/regras-5x2">Regras do 5x2</Link>. Em caso de dúvida específica, consulte o
            contador.
          </p>
        </Faq>
      </div>
    </InfoPage>
  );
}
