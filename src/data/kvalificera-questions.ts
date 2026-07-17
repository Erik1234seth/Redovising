export interface Question {
  id: string;
  text: string;
  /** Answering with this value disqualifies the visitor. */
  disqualifyOn: boolean;
  reason: string;
  help: string;
}

export const questions: Question[] = [
  { id: 'enskild', text: 'Driver du en enskild firma?', disqualifyOn: false, reason: 'Enkla Bokslut är byggt specifikt för enskilda firmor.', help: 'Aktiebolag, handelsbolag och andra företagsformer har andra regler och omfattas därför inte av tjänsten.' },
  { id: 'omsattning', text: 'Har din verksamhet en årsomsättning på högst 3 miljoner kronor?', disqualifyOn: false, reason: 'Vi riktar oss till enskilda firmor med en årsomsättning på högst 3 miljoner kronor.', help: 'Enkla Bokslut bygger på de förenklade regler som gäller för verksamheter med en årsomsättning på högst 3 miljoner kronor.' },
  { id: 'anstallda', text: 'Har du anställd personal?', disqualifyOn: true, reason: 'I dagsläget kan vi tyvärr inte hjälpa företag som har anställd personal.', help: 'Vi menar anställd personal. Att köpa tjänster från andra företag eller anlita underentreprenörer räknas inte som anställd personal.' },
  { id: 'skog', text: 'Bedriver du skogs- eller lantbruksverksamhet?', disqualifyOn: true, reason: 'Vi kan tyvärr inte hjälpa skogs- eller lantbruksverksamhet.', help: 'Skogs- och lantbruksverksamheter omfattas av särskilda regler, till exempel kring skogskonto, skogsavdrag och andra skatteregler. Därför omfattas de inte av Enkla Bokslut.' },
  { id: 'taxi', text: 'Driver du taxi- eller annan yrkesmässig persontransport?', disqualifyOn: true, reason: 'Vi kan tyvärr inte hjälpa taxiverksamhet.', help: 'Taxi- och persontransportverksamheter har särskilda regler för bland annat kassahantering, redovisning och beskattning. Därför omfattas de inte av Enkla Bokslut.' },
  { id: 'vmb', text: 'Använder din verksamhet vinstmarginalbeskattning (VMB)?', disqualifyOn: true, reason: 'Vi kan tyvärr inte hjälpa verksamheter som använder vinstmarginalbeskattning (VMB).', help: 'Vi syftar på verksamheter som handlar med exempelvis begagnade bilar, konst, tavlor, antikviteter, samlarföremål eller andra begagnade varor där vinstmarginalbeskattning (VMB) kan användas. Dessa omfattas av särskilda momsregler som inte stöds av Enkla Bokslut.' },
  { id: 'utlandsmoms', text: 'Redovisar du moms i något annat land än Sverige, eller använder du OSS (One Stop Shop)?', disqualifyOn: true, reason: 'Enkla Bokslut är utvecklat för företag som endast redovisar svensk moms. Redovisning i flera länder innebär andra regler och deklarationer som inte ingår i tjänsten.', help: 'Osäker? Den här frågan gäller främst företag som säljer till privatpersoner i andra EU-länder eller är momsregistrerade utanför Sverige.' },
];
