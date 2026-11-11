// Fill locale gaps and explain unavailable services alongside the settings strings.
export const LOCAL_STRINGS: Record<string, { en: string; es: string; 'pt-BR': string }> = {
  'common.loading': { en: 'Loading…', es: 'Cargando…', 'pt-BR': 'Carregando…' },
  'settings.models.keyRefused': {
    en: 'Unavailable until OpenAI accepts the API key.',
    es: 'No disponible hasta que OpenAI acepte la clave de API.',
    'pt-BR': 'Indisponível até a OpenAI aceitar a chave de API.',
  },
  'settings.tabs.audio': { en: 'Audio & Screen', es: 'Audio y pantalla', 'pt-BR': 'Áudio e tela' },
  'settings.tabs.permissions': { en: 'Permissions', es: 'Permisos', 'pt-BR': 'Permissões' },
  'settings.tabs.features': { en: 'Features', es: 'Funciones', 'pt-BR': 'Recursos' },
  'local.noAudioDriver': {
    en: 'This build has no audio driver of its own. Choose a source below; meeting audio is captured without one.',
    es: 'Esta versión no tiene controlador de audio propio. Elige una fuente abajo; el audio de la reunión se captura sin él.',
    'pt-BR':
      'Esta versão não tem driver de áudio próprio. Escolha uma fonte abaixo; o áudio da reunião é capturado sem ele.',
  },
  'local.meetingGuideUnavailable': {
    en: 'This build has no meeting audio guide of its own.',
    es: 'Esta versión no tiene una guía propia de audio de reuniones.',
    'pt-BR': 'Esta versão não tem um guia próprio de áudio de reuniões.',
  },
  'local.runtimeMissingTitle': {
    en: '{{binary}} is not installed',
    es: '{{binary}} no está instalado',
    'pt-BR': '{{binary}} não está instalado',
  },
  'local.runtimeMissingText': {
    en: 'LearnTranscriber runs local models with {{binary}}. Install it with Homebrew or choose an existing executable.',
    es: 'LearnTranscriber ejecuta los modelos locales con {{binary}}. Instálalo con Homebrew o elige un ejecutable existente.',
    'pt-BR':
      'O LearnTranscriber roda modelos locais com o {{binary}}. Instale com o Homebrew ou escolha um executável existente.',
  },
  'local.runtimeInstall': {
    en: 'Install with Homebrew',
    es: 'Instalar con Homebrew',
    'pt-BR': 'Instalar com Homebrew',
  },
  'local.runtimeChoose': {
    en: 'Choose {{binary}}',
    es: 'Elegir {{binary}}',
    'pt-BR': 'Escolher {{binary}}',
  },
}
