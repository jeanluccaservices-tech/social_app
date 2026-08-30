import React from 'react';
import { X, ScrollText } from 'lucide-react';

const SECTIONS = [
  {
    title: '1. Aceite dos Termos',
    body: [
      'Ao criar uma conta no LoveVibe, você declara que leu, entendeu e concorda integralmente com estes Termos de Uso e com a Política de Privacidade aqui descrita. Se você não concorda com algum ponto, não deve utilizar a plataforma.',
      'É necessário ter 18 anos ou mais para se cadastrar. Contas de casais exigem que ambos os integrantes atendam a esse requisito.'
    ]
  },
  {
    title: '2. Responsabilidade pelo Conteúdo',
    body: [
      'Cada usuário é o único e exclusivo responsável pelo conteúdo que publica — textos, fotos, comentários e mensagens —, inclusive por sua veracidade e pelas consequências de sua divulgação.',
      'O LoveVibe não se responsabiliza por conteúdos postados por terceiros, mas pode removê-los e tomar as medidas previstas nestes Termos quando violarem as regras abaixo.'
    ]
  },
  {
    title: '3. O que pode ser postado',
    body: [
      'Conteúdo autêntico, respeitoso e compatível com a proposta da plataforma (uma rede de relacionamentos para solteiros e casais): fotos e informações verdadeiras suas, textos sobre você mesmo, e interações respeitosas com outros usuários.'
    ]
  },
  {
    title: '4. O que é proibido',
    list: [
      'Publicar fotos de terceiros sem autorização, fotos falsas, ou usar imagens que não sejam suas.',
      'Criar ou manter perfis falsos (fake), se passando por outra pessoa ou identidade fictícia.',
      'Divulgar dados pessoais — seus ou de terceiros — como telefone, endereço, CPF, e-mail ou outras informações sensíveis em publicações, comentários ou em qualquer área visível a outros usuários.',
      'Ofender, assediar, ameaçar ou praticar bullying contra qualquer pessoa dentro da plataforma.',
      'Publicar conteúdo ilegal, discurso de ódio, spam, golpes financeiros ou qualquer material que viole direitos de terceiros ou a legislação vigente.'
    ]
  },
  {
    title: '5. Proteção de Fotos e Proibição de Capturas de Tela',
    body: [
      'As fotos publicadas no LoveVibe — no feed, em perfis, em salas de grupo e em conversas privadas — podem ser vistas apenas dentro da plataforma. O aplicativo aplica medidas técnicas para dificultar o download, salvamento e arraste dessas imagens (bloqueio do menu de salvar imagem, do arrastar para salvar e do toque longo em dispositivos móveis).',
      'É expressamente proibido baixar, copiar, capturar (print/screenshot), gravar a tela, redistribuir ou reutilizar, por qualquer meio, fotos ou vídeos de outros usuários sem autorização explícita da pessoa retratada, mesmo quando a medida técnica puder ser contornada.',
      'O descumprimento desta regra é tratado como violação grave dos Termos, sujeita às sanções previstas na seção 7, incluindo suspensão ou banimento, sem prejuízo de outras medidas legais cabíveis quando aplicável.'
    ]
  },
  {
    title: '6. Privacidade e Proteção de Dados',
    body: [
      'Seus dados são armazenados de forma criptografada e tratados com as medidas de segurança adequadas para impedir acesso não autorizado.',
      'O LoveVibe não divulga, vende nem compartilha seus dados pessoais com terceiros, exceto quando exigido por lei ou ordem judicial.',
      'O tratamento de dados segue os princípios da Lei Geral de Proteção de Dados (LGPD), e você pode solicitar informações, correção ou exclusão dos seus dados a qualquer momento pelo suporte.'
    ]
  },
  {
    title: '7. Denúncias e Sanções',
    body: [
      'Qualquer usuário pode denunciar publicações ou perfis que considere violarem estes Termos. Denúncias são analisadas pela moderação, que pode aplicar, conforme a gravidade:',
    ],
    list: [
      'Advertência ao usuário responsável.',
      'Remoção do conteúdo denunciado.',
      'Suspensão temporária da conta.',
      'Banimento permanente da plataforma, em casos graves ou de reincidência.'
    ]
  },
  {
    title: '8. Encerramento de Conta',
    body: [
      'Você pode encerrar sua conta a qualquer momento pela área "Editar Perfil". O encerramento é definitivo: seus dados, publicações e conversas são removidos permanentemente, conforme descrito na tela de confirmação.',
      'O LoveVibe também pode encerrar contas que violem repetidamente estes Termos, independentemente de solicitação do usuário.'
    ]
  },
  {
    title: '9. Alterações nestes Termos',
    body: [
      'Estes Termos podem ser atualizados periodicamente para refletir mudanças na plataforma ou na legislação. O uso continuado do LoveVibe após uma atualização representa a aceitação dos novos termos.'
    ]
  },
  {
    title: '10. Contato',
    body: [
      'Dúvidas sobre estes Termos, privacidade ou sobre sua conta podem ser enviadas para suporte@lovevibe.com.br.'
    ]
  }
];

export const TermsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[var(--c-surface)] border border-rose-500/30 rounded-3xl shadow-2xl shadow-rose-950/50 overflow-hidden my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 text-[var(--c-text-muted)] hover:text-[var(--c-text)] p-2 rounded-full hover:bg-[var(--c-overlay-10)] transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold text-[var(--c-text)] flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-rose-500" /> Termos de Uso e Privacidade
          </h2>
          <p className="text-xs text-[var(--c-text-muted)] mt-1">LoveVibe — Rede Social de Relacionamentos</p>
        </div>

        <div className="px-6 pb-6 space-y-5 max-h-[60vh] overflow-y-auto text-[var(--c-text-secondary)]">
          {SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1.5">
              <h3 className="text-xs font-bold text-[var(--c-text)] uppercase tracking-wide">{section.title}</h3>
              {section.body?.map((p, i) => (
                <p key={i} className="text-xs leading-relaxed">{p}</p>
              ))}
              {section.list && (
                <ul className="text-xs leading-relaxed list-disc pl-4 space-y-1">
                  {section.list.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
};
