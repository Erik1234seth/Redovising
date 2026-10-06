import { loadKnowledge } from './knowledge';
import { SERVICE_INFO } from './general-question-prompt';

// Tjänstebeskrivningen ur masterprompten v7 (Del 1) + allt innehåll från
// knowledge-mappen (interna dokument, bland annat länkregistret). Används av
// lead-svaren, så att de beskriver tjänsten likadant som kundfrågorna.
export const ENKLA_BOKSLUT_CONTEXT = `${SERVICE_INFO}${loadKnowledge()}`;
