import Link from "next/link";

export const metadata = {
  title: "Política de Privacidade | Recompensa Premiada",
  description: "Política de privacidade do aplicativo Recompensa Premiada.",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#070b18] px-4 py-10 text-slate-200 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl shadow-cyan-950/20 sm:p-10">
        <Link href="/" className="text-sm font-semibold text-cyan-300 hover:text-cyan-200">
          Recompensa Premiada
        </Link>
        <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
          Política de Privacidade
        </h1>
        <p className="mt-2 text-sm text-slate-400">Última atualização: 11 de julho de 2026</p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300">
          <section>
            <h2 className="text-lg font-semibold text-white">1. Sobre esta política</h2>
            <p className="mt-2">
              Esta política explica como o Recompensa Premiada coleta, usa e protege informações
              quando você utiliza o site ou o aplicativo. Ao utilizar o serviço, você declara que
              leu esta política.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">2. Informações coletadas</h2>
            <p className="mt-2">
              Podemos coletar informações de cadastro e autenticação, como nome de exibição,
              endereço de e-mail, identificador da conta e foto escolhida pelo usuário. Também
              registramos dados necessários para o funcionamento dos jogos, partidas, missões,
              ranking, convites, carteira virtual e atendimento.
            </p>
            <p className="mt-2">
              O aplicativo pode receber dados técnicos e de uso, como dispositivo, sistema,
              eventos de erro, telas acessadas e identificadores de publicidade, conforme as
              configurações do dispositivo e dos serviços de terceiros.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">3. Como usamos as informações</h2>
            <p className="mt-2">
              Usamos essas informações para autenticar contas, manter partidas multiplayer,
              calcular recompensas e rankings, prevenir fraude e abuso, responder solicitações,
              melhorar estabilidade e cumprir obrigações legais.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">4. Serviços de terceiros</h2>
            <p className="mt-2">
              Usamos serviços do Google Firebase para autenticação, banco de dados, hospedagem,
              funções de servidor e monitoramento técnico. O aplicativo também pode usar Google
              AdMob para exibir anúncios, inclusive anúncios recompensados. Esses serviços podem
              processar informações conforme suas próprias políticas de privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">5. Compartilhamento e segurança</h2>
            <p className="mt-2">
              Não vendemos dados pessoais. Compartilhamos informações somente quando necessário
              para operar os serviços de terceiros descritos acima, cumprir a lei, proteger o
              serviço ou proteger direitos dos usuários e da operação. Utilizamos conexões
              protegidas e controles de acesso para reduzir riscos, mas nenhum serviço conectado à
              internet é completamente livre de riscos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">6. Seus direitos e exclusão</h2>
            <p className="mt-2">
              Você pode solicitar acesso, correção ou exclusão dos dados associados à sua conta,
              observadas as informações que precisamos manter por obrigação legal, segurança ou
              prevenção de fraude. Para solicitar atendimento, use o canal de suporte disponível
              dentro do aplicativo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">7. Alterações</h2>
            <p className="mt-2">
              Esta política pode ser atualizada para refletir mudanças no serviço, na legislação
              ou nos provedores utilizados. A versão mais recente ficará disponível nesta página.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
