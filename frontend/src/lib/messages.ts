export const messages = {
	'app.name': 'Rastro',
	'app.tagline': 'Rastreamento de localização pessoal',

	'nav.main': 'Navegação principal',
	'nav.collapse': 'Recolher menu',
	'nav.more': 'Mais',
	'nav.map': 'Mapa',
	'nav.devices': 'Dispositivos',
	'nav.settings': 'Configurações',
	'nav.login': 'Entrar',

	'common.close': 'Fechar',
	'common.confirm': 'Confirmar',
	'common.cancel': 'Cancelar',
	'common.typeToConfirm': 'Digite {value} para confirmar',
	'common.loading': 'Carregando…',

	'toast.region': 'Notificações',

	'theme.system': 'Sistema',
	'theme.light': 'Claro',
	'theme.dark': 'Escuro',
	'theme.switchTo': 'Tema: {current}. Mudar para {next}.',

	'auth.signOut': 'Sair da conta',
	'auth.session': 'Sessão',

	'login.signIn': 'Entrar',
	'login.signUp': 'Criar conta',
	'login.submitting': 'Aguarde…',
	'login.accountCreated': 'Conta criada! Você já está logado.',
	'login.email': 'E-mail',
	'login.emailPlaceholder': 'seu@email.com',
	'login.password': 'Senha',
	'login.passwordPlaceholder': '••••••••',

	'settings.account': 'Conta',
	'settings.email': 'E-mail',
	'settings.userId': 'ID',
	'settings.preferences': 'Preferências',
	'settings.pollingInterval': 'Intervalo de atualização',
	'settings.pollingIntervalHint': 'Frequência com que o mapa busca a última localização.',
	'settings.appearance': 'Aparência',
	'settings.theme': 'Tema',

	'duration.lessThanMinute': 'menos de 1min',
	'duration.minutes': '{minutes}min',
	'duration.hours': '{hours}h',
	'duration.hoursMinutes': '{hours}h{minutes}min',

	'error.unexpected': 'A aplicação encontrou um problema inesperado.',

	'page.map.title': 'Mapa',
	'page.devices.title': 'Dispositivos'
} as const;

export type MessageKey = keyof typeof messages;

export const t = (key: MessageKey, params?: Record<string, string | number>): string => {
	const template: string = messages[key];
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in params ? String(params[name]) : match
	);
};
