import { useState } from 'react';

/**
 * GTM Workspace with Left Sidebar Navigation (Option B)
 * Main navigation: Pipeline | Inbox | Analytics
 * Supports: English, Spanish, French, German, Russian
 */

export default function PipelineWorkspaceWithSidebar() {
  const [isDark, setIsDark] = useState(false);
  const [currentPage, setCurrentPage] = useState('pipeline'); // pipeline | inbox | analytics
  const [currentStep, setCurrentStep] = useState('icp');
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [language, setLanguage] = useState('en');
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false); // true = wide (240px), false = narrow (72px)
  
  // Simulated state - tracks what user has completed
  const [completed, setCompleted] = useState({
    icp: null,
    hypothesis: null,
    segment: null,
    enrichment: false,
    draft: null,
    sim: null,
  });

  // Comprehensive translations
  const translations = {
    en: {
      hero: {
        title1: 'Turn prospects into ',
        title2: 'pipeline-ready',
        title3: ' conversations',
        subtitle: 'Power your GTM with AI-driven workflows. From ICP discovery to inbox management.',
      },
      title: 'GTM Pipeline',
      inbox: 'Inbox',
      analytics: 'Analytics',
      promptRegistry: 'Prompt Registry',
      navPipeline: 'Pipeline',
      navInbox: 'Inbox',
      navAnalytics: 'Analytics',
      navPromptRegistry: 'Prompts',
      collapseNav: 'Collapse',
      currentConfig: 'Current Configuration',
      notSelected: 'Not selected',
      settings: 'Settings',
      services: 'Services',
      steps: {
        icp: { label: 'ICP', description: 'Define your Ideal Customer Profile' },
        hypothesis: { label: 'Hypothesis', description: 'Create targeting hypothesis' },
        segment: { label: 'Segment', description: 'Select or generate segments' },
        enrichment: { label: 'Enrich', description: 'Enrich companies and leads' },
        draft: { label: 'Draft', description: 'Generate personalized emails' },
        sim: { label: 'Sim', description: 'Coming Soon', comingSoon: true },
        send: { label: 'Send', description: 'Choose delivery method' },
      },
      icp: {
        title: 'Choose or Create ICP',
        subtitle: 'Start by defining your Ideal Customer Profile. You can choose from existing ICPs or create a new one.',
        chooseExisting: 'Choose Existing',
        createNew: 'Create New',
        companies: 'companies',
        updated: 'Updated',
        chatWithAI: 'Chat with AI',
        chatDesc: 'Describe your ideal customer and let AI help',
        quickEntry: 'Quick Entry',
        quickDesc: 'Enter details directly in a form',
      },
      hypothesis: {
        title: 'Choose or Create Hypothesis',
        subtitle: 'Based on your ICP:',
        suggested: 'Suggested Hypotheses',
        confidence: 'Confidence',
        chatDesc: 'Brainstorm targeting hypotheses together',
        writeHyp: 'Write Hypothesis',
        writeDesc: 'Type your targeting hypothesis directly',
      },
      segment: {
        title: 'Select or Generate Segments',
        subtitle: 'ICP:',
        hypothesis: 'Hypothesis:',
        matching: 'Matching Segments',
        source: 'Source',
        generateNew: 'Generate New',
        searchDB: 'Search Database',
        searchDesc: 'Query your existing company database',
        exaSearch: 'EXA Web Search',
        exaDesc: 'Find new companies from the web',
      },
      enrichment: {
        title: 'Enrich Segment Data',
        subtitle: 'Enriching',
        from: 'from:',
        optional: 'Optional Step',
        optionalDesc: 'Enrichment improves personalization but you can skip this step and proceed directly to drafting if needed.',
        companyData: 'Company Data',
        companyDesc: 'Industry, size, funding, tech stack',
        leadDetails: 'Lead Details',
        leadDesc: 'Contacts, roles, LinkedIn profiles',
        webIntel: 'Web Intelligence',
        webDesc: 'Recent news, hiring, product launches',
        enrich: 'Enrich',
        skip: 'Skip Enrichment →',
      },
      locked: {
        title: 'Complete previous steps',
        subtitle: 'You need to complete the previous steps before accessing this section.',
      },
      aiChat: {
        title: 'AI Assistant',
        greeting: 'Hi! I\'m your AI assistant. I can help you create a new',
        greeting2: 'based on your requirements. Just describe what you\'re looking for and I\'ll guide you through the process.',
        placeholder: 'Type your message...',
        send: 'Send',
      },
      settingsModal: {
        title: 'Settings',
        aiProviders: 'AI Providers',
        taskConfig: 'Task Configuration',
        provider: 'Provider',
        model: 'Model',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'ICP Discovery',
          hypothesisGen: 'Hypothesis Generation',
          emailDraft: 'Email Draft',
          linkedinMsg: 'LinkedIn Message',
        },
      },
      servicesModal: {
        title: 'Services Status',
        categories: {
          database: 'Database',
          llm: 'LLM',
          delivery: 'Delivery',
          enrichment: 'Enrichment',
        },
      },
      inboxPage: {
        title: 'Inbox',
        subtitle: 'Manage your campaign replies and conversations',
        unread: 'Unread',
        all: 'All',
        starred: 'Starred',
        noMessages: 'No messages yet',
        noMessagesDesc: 'When you receive replies from your campaigns, they\'ll appear here.',
      },
      analyticsPage: {
        title: 'Analytics',
        subtitle: 'Track your campaign performance and metrics',
        overview: 'Overview',
        campaigns: 'Campaigns',
        performance: 'Performance',
        noData: 'No data available',
        noDataDesc: 'Start running campaigns to see analytics data here.',
      },
      promptRegistryPage: {
        title: 'Prompt Registry',
        subtitle: 'Manage and optimize your AI prompts across workflows',
        allPrompts: 'All Prompts',
        active: 'Active',
        pilot: 'Pilot',
        retired: 'Retired',
        createNew: 'Create Prompt',
        noPrompts: 'No prompts yet',
        noPromptsDesc: 'Create your first prompt to start optimizing your AI workflows.',
        step: 'Step',
        version: 'Version',
        status: 'Status',
        description: 'Description',
        promptId: 'Prompt ID',
        promptText: 'Prompt Text',
      },
    },
    es: {
      hero: {
        title1: 'Convierte prospectos en conversaciones ',
        title2: 'listas para el pipeline',
        title3: '',
        subtitle: 'Potencia tu GTM con flujos de trabajo impulsados por IA. Desde el descubrimiento de ICP hasta la gestión de bandeja de entrada.',
      },
      title: 'Pipeline GTM',
      inbox: 'Bandeja',
      analytics: 'Analítica',
      navPipeline: 'Pipeline',
      navInbox: 'Bandeja',
      navAnalytics: 'Analítica',
      collapseNav: 'Contraer',
      currentConfig: 'Configuración Actual',
      notSelected: 'No seleccionado',
      settings: 'Configuración',
      services: 'Servicios',
      steps: {
        icp: { label: 'ICP', description: 'Define tu Perfil de Cliente Ideal' },
        hypothesis: { label: 'Hipótesis', description: 'Crear hipótesis de targeting' },
        segment: { label: 'Segmento', description: 'Seleccionar o generar segmentos' },
        enrichment: { label: 'Enriquecer', description: 'Enriquecer empresas y leads' },
        draft: { label: 'Borrador', description: 'Generar emails personalizados' },
        sim: { label: 'Sim', description: 'Próximamente', comingSoon: true },
        send: { label: 'Enviar', description: 'Elegir método de entrega' },
      },
      icp: {
        title: 'Elegir o Crear ICP',
        subtitle: 'Comienza definiendo tu Perfil de Cliente Ideal. Puedes elegir ICPs existentes o crear uno nuevo.',
        chooseExisting: 'Elegir Existente',
        createNew: 'Crear Nuevo',
        companies: 'empresas',
        updated: 'Actualizado',
        chatWithAI: 'Chatear con IA',
        chatDesc: 'Describe tu cliente ideal y deja que la IA ayude',
        quickEntry: 'Entrada Rápida',
        quickDesc: 'Ingresa detalles directamente en un formulario',
      },
      hypothesis: {
        title: 'Elegir o Crear Hipótesis',
        subtitle: 'Basado en tu ICP:',
        suggested: 'Hipótesis Sugeridas',
        confidence: 'Confianza',
        chatDesc: 'Lluvia de ideas sobre hipótesis de targeting',
        writeHyp: 'Escribir Hipótesis',
        writeDesc: 'Escribe tu hipótesis de targeting directamente',
      },
      segment: {
        title: 'Seleccionar o Generar Segmentos',
        subtitle: 'ICP:',
        hypothesis: 'Hipótesis:',
        matching: 'Segmentos Coincidentes',
        source: 'Fuente',
        generateNew: 'Generar Nuevo',
        searchDB: 'Buscar en Base de Datos',
        searchDesc: 'Consulta tu base de datos de empresas existente',
        exaSearch: 'Búsqueda Web EXA',
        exaDesc: 'Encuentra nuevas empresas en la web',
      },
      enrichment: {
        title: 'Enriquecer Datos del Segmento',
        subtitle: 'Enriqueciendo',
        from: 'de:',
        optional: 'Paso Opcional',
        optionalDesc: 'El enriquecimiento mejora la personalización pero puedes omitir este paso y proceder directamente al borrador si es necesario.',
        companyData: 'Datos de Empresa',
        companyDesc: 'Industria, tamaño, financiación, stack tecnológico',
        leadDetails: 'Detalles de Lead',
        leadDesc: 'Contactos, roles, perfiles de LinkedIn',
        webIntel: 'Inteligencia Web',
        webDesc: 'Noticias recientes, contrataciones, lanzamientos de productos',
        enrich: 'Enriquecer',
        skip: 'Omitir Enriquecimiento →',
      },
      locked: {
        title: 'Completa los pasos anteriores',
        subtitle: 'Necesitas completar los pasos anteriores antes de acceder a esta sección.',
      },
      aiChat: {
        title: 'Asistente IA',
        greeting: '¡Hola! Soy tu asistente de IA. Puedo ayudarte a crear un nuevo',
        greeting2: 'basado en tus requisitos. Solo describe lo que buscas y te guiaré en el proceso.',
        placeholder: 'Escribe tu mensaje...',
        send: 'Enviar',
      },
      settingsModal: {
        title: 'Configuración',
        aiProviders: 'Proveedores de IA',
        taskConfig: 'Configuración de Tareas',
        provider: 'Proveedor',
        model: 'Modelo',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'Descubrimiento de ICP',
          hypothesisGen: 'Generación de Hipótesis',
          emailDraft: 'Borrador de Email',
          linkedinMsg: 'Mensaje de LinkedIn',
        },
      },
      servicesModal: {
        title: 'Estado de Servicios',
        categories: {
          database: 'Base de Datos',
          llm: 'LLM',
          delivery: 'Entrega',
          enrichment: 'Enriquecimiento',
        },
      },
      inboxPage: {
        title: 'Bandeja de Entrada',
        subtitle: 'Gestiona las respuestas y conversaciones de tus campañas',
        unread: 'No Leídos',
        all: 'Todos',
        starred: 'Destacados',
        noMessages: 'Aún no hay mensajes',
        noMessagesDesc: 'Cuando recibas respuestas de tus campañas, aparecerán aquí.',
      },
      analyticsPage: {
        title: 'Analítica',
        subtitle: 'Rastrea el rendimiento y métricas de tus campañas',
        overview: 'Resumen',
        campaigns: 'Campañas',
        performance: 'Rendimiento',
        noData: 'No hay datos disponibles',
        noDataDesc: 'Comienza a ejecutar campañas para ver datos analíticos aquí.',
      },
      promptRegistryPage: {
        title: 'Registro de Prompts',
        subtitle: 'Gestiona y optimiza tus prompts de IA en todos los flujos de trabajo',
        allPrompts: 'Todos los Prompts',
        active: 'Activo',
        pilot: 'Piloto',
        retired: 'Retirado',
        createNew: 'Crear Prompt',
        noPrompts: 'Aún no hay prompts',
        noPromptsDesc: 'Crea tu primer prompt para comenzar a optimizar tus flujos de trabajo de IA.',
        step: 'Paso',
        version: 'Versión',
        status: 'Estado',
        description: 'Descripción',
        promptId: 'ID de Prompt',
        promptText: 'Texto del Prompt',
      },
    },
    fr: {
      hero: {
        title1: 'Transformez les prospects en conversations ',
        title2: 'prêtes pour le pipeline',
        title3: '',
        subtitle: 'Dynamisez votre GTM avec des flux de travail pilotés par l\'IA. De la découverte d\'ICP à la gestion de la boîte de réception.',
      },
      title: 'Pipeline GTM',
      inbox: 'Boîte de Réception',
      analytics: 'Analytique',
      navPipeline: 'Pipeline',
      navInbox: 'Boîte de Réception',
      navAnalytics: 'Analytique',
      collapseNav: 'Réduire',
      currentConfig: 'Configuration Actuelle',
      notSelected: 'Non sélectionné',
      settings: 'Paramètres',
      services: 'Services',
      steps: {
        icp: { label: 'ICP', description: 'Définir votre Profil Client Idéal' },
        hypothesis: { label: 'Hypothèse', description: 'Créer une hypothèse de ciblage' },
        segment: { label: 'Segment', description: 'Sélectionner ou générer des segments' },
        enrichment: { label: 'Enrichir', description: 'Enrichir les entreprises et leads' },
        draft: { label: 'Brouillon', description: 'Générer des emails personnalisés' },
        sim: { label: 'Sim', description: 'Bientôt Disponible', comingSoon: true },
        send: { label: 'Envoyer', description: 'Choisir la méthode de livraison' },
      },
      icp: {
        title: 'Choisir ou Créer un ICP',
        subtitle: 'Commencez par définir votre Profil Client Idéal. Vous pouvez choisir parmi les ICP existants ou en créer un nouveau.',
        chooseExisting: 'Choisir Existant',
        createNew: 'Créer Nouveau',
        companies: 'entreprises',
        updated: 'Mis à jour',
        chatWithAI: 'Discuter avec l\'IA',
        chatDesc: 'Décrivez votre client idéal et laissez l\'IA vous aider',
        quickEntry: 'Saisie Rapide',
        quickDesc: 'Entrez les détails directement dans un formulaire',
      },
      hypothesis: {
        title: 'Choisir ou Créer une Hypothèse',
        subtitle: 'Basé sur votre ICP:',
        suggested: 'Hypothèses Suggérées',
        confidence: 'Confiance',
        chatDesc: 'Brainstorming d\'hypothèses de ciblage ensemble',
        writeHyp: 'Écrire l\'Hypothèse',
        writeDesc: 'Tapez votre hypothèse de ciblage directement',
      },
      segment: {
        title: 'Sélectionner ou Générer des Segments',
        subtitle: 'ICP:',
        hypothesis: 'Hypothèse:',
        matching: 'Segments Correspondants',
        source: 'Source',
        generateNew: 'Générer Nouveau',
        searchDB: 'Rechercher dans la Base de Données',
        searchDesc: 'Interrogez votre base de données d\'entreprises existante',
        exaSearch: 'Recherche Web EXA',
        exaDesc: 'Trouvez de nouvelles entreprises sur le web',
      },
      enrichment: {
        title: 'Enrichir les Données du Segment',
        subtitle: 'Enrichissement',
        from: 'de:',
        optional: 'Étape Optionnelle',
        optionalDesc: 'L\'enrichissement améliore la personnalisation mais vous pouvez ignorer cette étape et passer directement au brouillon si nécessaire.',
        companyData: 'Données d\'Entreprise',
        companyDesc: 'Industrie, taille, financement, stack technologique',
        leadDetails: 'Détails du Lead',
        leadDesc: 'Contacts, rôles, profils LinkedIn',
        webIntel: 'Intelligence Web',
        webDesc: 'Actualités récentes, recrutements, lancements de produits',
        enrich: 'Enrichir',
        skip: 'Ignorer l\'Enrichissement →',
      },
      locked: {
        title: 'Complétez les étapes précédentes',
        subtitle: 'Vous devez compléter les étapes précédentes avant d\'accéder à cette section.',
      },
      aiChat: {
        title: 'Assistant IA',
        greeting: 'Bonjour! Je suis votre assistant IA. Je peux vous aider à créer un nouveau',
        greeting2: 'basé sur vos exigences. Décrivez simplement ce que vous cherchez et je vous guiderai tout au long du processus.',
        placeholder: 'Tapez votre message...',
        send: 'Envoyer',
      },
      settingsModal: {
        title: 'Paramètres',
        aiProviders: 'Fournisseurs d\'IA',
        taskConfig: 'Configuration des Tâches',
        provider: 'Fournisseur',
        model: 'Modèle',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'Découverte d\'ICP',
          hypothesisGen: 'Génération d\'Hypothèse',
          emailDraft: 'Brouillon d\'Email',
          linkedinMsg: 'Message LinkedIn',
        },
      },
      servicesModal: {
        title: 'État des Services',
        categories: {
          database: 'Base de Données',
          llm: 'LLM',
          delivery: 'Livraison',
          enrichment: 'Enrichissement',
        },
      },
      inboxPage: {
        title: 'Boîte de Réception',
        subtitle: 'Gérez les réponses et conversations de vos campagnes',
        unread: 'Non Lus',
        all: 'Tous',
        starred: 'Favoris',
        noMessages: 'Pas encore de messages',
        noMessagesDesc: 'Lorsque vous recevrez des réponses de vos campagnes, elles apparaîtront ici.',
      },
      analyticsPage: {
        title: 'Analytique',
        subtitle: 'Suivez les performances et métriques de vos campagnes',
        overview: 'Aperçu',
        campaigns: 'Campagnes',
        performance: 'Performance',
        noData: 'Aucune donnée disponible',
        noDataDesc: 'Lancez des campagnes pour voir les données analytiques ici.',
      },
      promptRegistryPage: {
        title: 'Registre des Prompts',
        subtitle: 'Gérez et optimisez vos prompts IA dans tous les flux de travail',
        allPrompts: 'Tous les Prompts',
        active: 'Actif',
        pilot: 'Pilote',
        retired: 'Retiré',
        createNew: 'Créer Prompt',
        noPrompts: 'Pas encore de prompts',
        noPromptsDesc: 'Créez votre premier prompt pour commencer à optimiser vos flux de travail IA.',
        step: 'Étape',
        version: 'Version',
        status: 'Statut',
        description: 'Description',
        promptId: 'ID du Prompt',
        promptText: 'Texte du Prompt',
      },
    },
    de: {
      hero: {
        title1: 'Verwandeln Sie Interessenten in ',
        title2: 'pipeline-bereite',
        title3: ' Gespräche',
        subtitle: 'Stärken Sie Ihr GTM mit KI-gesteuerten Workflows. Von der ICP-Entdeckung bis zur Posteingang-Verwaltung.',
      },
      title: 'GTM Pipeline',
      inbox: 'Posteingang',
      analytics: 'Analytik',
      navPipeline: 'Pipeline',
      navInbox: 'Posteingang',
      navAnalytics: 'Analytik',
      collapseNav: 'Einklappen',
      currentConfig: 'Aktuelle Konfiguration',
      notSelected: 'Nicht ausgewählt',
      settings: 'Einstellungen',
      services: 'Dienste',
      steps: {
        icp: { label: 'ICP', description: 'Definieren Sie Ihr ideales Kundenprofil' },
        hypothesis: { label: 'Hypothese', description: 'Targeting-Hypothese erstellen' },
        segment: { label: 'Segment', description: 'Segmente auswählen oder generieren' },
        enrichment: { label: 'Anreichern', description: 'Unternehmen und Leads anreichern' },
        draft: { label: 'Entwurf', description: 'Personalisierte E-Mails generieren' },
        sim: { label: 'Sim', description: 'Demnächst Verfügbar', comingSoon: true },
        send: { label: 'Senden', description: 'Versandmethode wählen' },
      },
      icp: {
        title: 'ICP Auswählen oder Erstellen',
        subtitle: 'Beginnen Sie mit der Definition Ihres idealen Kundenprofils. Sie können aus bestehenden ICPs wählen oder ein neues erstellen.',
        chooseExisting: 'Vorhandenes Auswählen',
        createNew: 'Neu Erstellen',
        companies: 'Unternehmen',
        updated: 'Aktualisiert',
        chatWithAI: 'Mit KI Chatten',
        chatDesc: 'Beschreiben Sie Ihren idealen Kunden und lassen Sie KI helfen',
        quickEntry: 'Schnelleingabe',
        quickDesc: 'Details direkt in einem Formular eingeben',
      },
      hypothesis: {
        title: 'Hypothese Auswählen oder Erstellen',
        subtitle: 'Basierend auf Ihrem ICP:',
        suggested: 'Vorgeschlagene Hypothesen',
        confidence: 'Vertrauen',
        chatDesc: 'Brainstorming zu Targeting-Hypothesen',
        writeHyp: 'Hypothese Schreiben',
        writeDesc: 'Ihre Targeting-Hypothese direkt eingeben',
      },
      segment: {
        title: 'Segmente Auswählen oder Generieren',
        subtitle: 'ICP:',
        hypothesis: 'Hypothese:',
        matching: 'Passende Segmente',
        source: 'Quelle',
        generateNew: 'Neu Generieren',
        searchDB: 'Datenbank Durchsuchen',
        searchDesc: 'Ihre bestehende Unternehmensdatenbank abfragen',
        exaSearch: 'EXA Websuche',
        exaDesc: 'Neue Unternehmen im Web finden',
      },
      enrichment: {
        title: 'Segmentdaten Anreichern',
        subtitle: 'Anreicherung',
        from: 'von:',
        optional: 'Optionaler Schritt',
        optionalDesc: 'Anreicherung verbessert die Personalisierung, aber Sie können diesen Schritt überspringen und direkt zum Entwurf übergehen, wenn nötig.',
        companyData: 'Unternehmensdaten',
        companyDesc: 'Branche, Größe, Finanzierung, Tech-Stack',
        leadDetails: 'Lead-Details',
        leadDesc: 'Kontakte, Rollen, LinkedIn-Profile',
        webIntel: 'Web-Intelligenz',
        webDesc: 'Aktuelle Nachrichten, Einstellungen, Produkteinführungen',
        enrich: 'Anreichern',
        skip: 'Anreicherung Überspringen →',
      },
      locked: {
        title: 'Vorherige Schritte abschließen',
        subtitle: 'Sie müssen die vorherigen Schritte abschließen, bevor Sie auf diesen Abschnitt zugreifen können.',
      },
      aiChat: {
        title: 'KI-Assistent',
        greeting: 'Hallo! Ich bin Ihr KI-Assistent. Ich kann Ihnen helfen, ein neues',
        greeting2: 'basierend auf Ihren Anforderungen zu erstellen. Beschreiben Sie einfach, wonach Sie suchen, und ich werde Sie durch den Prozess führen.',
        placeholder: 'Ihre Nachricht eingeben...',
        send: 'Senden',
      },
      settingsModal: {
        title: 'Einstellungen',
        aiProviders: 'KI-Anbieter',
        taskConfig: 'Aufgabenkonfiguration',
        provider: 'Anbieter',
        model: 'Modell',
        prompt: 'Prompt',
        tasks: {
          icpDiscovery: 'ICP-Entdeckung',
          hypothesisGen: 'Hypothesengenerierung',
          emailDraft: 'E-Mail-Entwurf',
          linkedinMsg: 'LinkedIn-Nachricht',
        },
      },
      servicesModal: {
        title: 'Dienststatus',
        categories: {
          database: 'Datenbank',
          llm: 'LLM',
          delivery: 'Zustellung',
          enrichment: 'Anreicherung',
        },
      },
      inboxPage: {
        title: 'Posteingang',
        subtitle: 'Verwalten Sie Ihre Kampagnenantworten und Konversationen',
        unread: 'Ungelesen',
        all: 'Alle',
        starred: 'Mit Stern',
        noMessages: 'Noch keine Nachrichten',
        noMessagesDesc: 'Wenn Sie Antworten von Ihren Kampagnen erhalten, werden sie hier angezeigt.',
      },
      analyticsPage: {
        title: 'Analytik',
        subtitle: 'Verfolgen Sie die Leistung und Metriken Ihrer Kampagnen',
        overview: 'Übersicht',
        campaigns: 'Kampagnen',
        performance: 'Leistung',
        noData: 'Keine Daten verfügbar',
        noDataDesc: 'Starten Sie Kampagnen, um hier Analysedaten zu sehen.',
      },
      promptRegistryPage: {
        title: 'Prompt-Register',
        subtitle: 'Verwalten und optimieren Sie Ihre KI-Prompts über alle Workflows hinweg',
        allPrompts: 'Alle Prompts',
        active: 'Aktiv',
        pilot: 'Pilot',
        retired: 'Zurückgezogen',
        createNew: 'Prompt Erstellen',
        noPrompts: 'Noch keine Prompts',
        noPromptsDesc: 'Erstellen Sie Ihren ersten Prompt, um Ihre KI-Workflows zu optimieren.',
        step: 'Schritt',
        version: 'Version',
        status: 'Status',
        description: 'Beschreibung',
        promptId: 'Prompt-ID',
        promptText: 'Prompt-Text',
      },
    },
    ru: {
      hero: {
        title1: 'Превращайте лиды в ',
        title2: 'готовые для воронки',
        title3: ' разговоры',
        subtitle: 'Усильте ваш GTM с помощью AI-управляемых процессов. От поиска ICP до управления входящими.',
      },
      title: 'GTM Воронка',
      inbox: 'Входящие',
      analytics: 'Аналитика',
      navPipeline: 'Воронка',
      navInbox: 'Входящие',
      navAnalytics: 'Аналитика',
      collapseNav: 'Свернуть',
      currentConfig: 'Текущая Конфигурация',
      notSelected: 'Не выбрано',
      settings: 'Настройки',
      services: 'Сервисы',
      steps: {
        icp: { label: 'ICP', description: 'Определите идеальный профиль клиента' },
        hypothesis: { label: 'Гипотеза', description: 'Создать гипотезу таргетинга' },
        segment: { label: 'Сегмент', description: 'Выбрать или сгенерировать сегменты' },
        enrichment: { label: 'Обогащение', description: 'Обогатить компании и лиды' },
        draft: { label: 'Черновик', description: 'Создать персонализированные письма' },
        sim: { label: 'Sim', description: 'Скоро Будет', comingSoon: true },
        send: { label: 'Отправка', description: 'Выбрать способ доставки' },
      },
      icp: {
        title: 'Выбрать или Создать ICP',
        subtitle: 'Начните с определения вашего идеального профиля клиента. Вы можете выбрать из существующих ICP или создать новый.',
        chooseExisting: 'Выбрать Существующий',
        createNew: 'Создать Новый',
        companies: 'компаний',
        updated: 'Обновлено',
        chatWithAI: 'Чат с ИИ',
        chatDesc: 'Опишите вашего идеального клиента и позвольте ИИ помочь',
        quickEntry: 'Быстрый Ввод',
        quickDesc: 'Введите детали напрямую в форму',
      },
      hypothesis: {
        title: 'Выбрать или Создать Гипотезу',
        subtitle: 'На основе вашего ICP:',
        suggested: 'Предложенные Гипотезы',
        confidence: 'Уверенность',
        chatDesc: 'Мозговой штурм гипотез таргетинга вместе',
        writeHyp: 'Написать Гипотезу',
        writeDesc: 'Напишите вашу гипотезу таргетинга напрямую',
      },
      segment: {
        title: 'Выбрать или Сгенерировать Сегменты',
        subtitle: 'ICP:',
        hypothesis: 'Гипотеза:',
        matching: 'Подходящие Сегменты',
        source: 'Источник',
        generateNew: 'Сгенерировать Новый',
        searchDB: 'Поиск в Базе Данных',
        searchDesc: 'Запросите вашу существующую базу данных компаний',
        exaSearch: 'Веб-Поиск EXA',
        exaDesc: 'Найдите новые компании в интернете',
      },
      enrichment: {
        title: 'Обогатить Данные Сегмента',
        subtitle: 'Обогащение',
        from: 'из:',
        optional: 'Необязательный Шаг',
        optionalDesc: 'Обогащение улучшает персонализацию, но вы можете пропустить этот шаг и перейти непосредственно к черновику при необходимости.',
        companyData: 'Данные Компании',
        companyDesc: 'Отрасль, размер, финансирование, технологический стек',
        leadDetails: 'Детали Лида',
        leadDesc: 'Контакты, роли, профили LinkedIn',
        webIntel: 'Веб-Разведка',
        webDesc: 'Последние новости, найм, запуски продуктов',
        enrich: 'Обогатить',
        skip: 'Пропустить Обогащение →',
      },
      locked: {
        title: 'Завершите предыдущие шаги',
        subtitle: 'Вам нужно завершить предыдущие шаги перед доступом к этому разделу.',
      },
      aiChat: {
        title: 'ИИ Помощник',
        greeting: 'Привет! Я ваш ИИ-помощник. Я могу помочь вам создать новый',
        greeting2: 'на основе ваших требований. Просто опишите, что вы ищете, и я проведу вас через процесс.',
        placeholder: 'Введите ваше сообщение...',
        send: 'Отправить',
      },
      settingsModal: {
        title: 'Настройки',
        aiProviders: 'Провайдеры ИИ',
        taskConfig: 'Конфигурация Задач',
        provider: 'Провайдер',
        model: 'Модель',
        prompt: 'Промпт',
        tasks: {
          icpDiscovery: 'Поиск ICP',
          hypothesisGen: 'Генерация Гипотез',
          emailDraft: 'Черновик Письма',
          linkedinMsg: 'Сообщение LinkedIn',
        },
      },
      servicesModal: {
        title: 'Статус Сервисов',
        categories: {
          database: 'База Данных',
          llm: 'LLM',
          delivery: 'Доставка',
          enrichment: 'Обогащение',
        },
      },
      inboxPage: {
        title: 'Входящие',
        subtitle: 'Управляйте ответами и разговорами ваших кампаний',
        unread: 'Непрочитанные',
        all: 'Все',
        starred: 'Избранные',
        noMessages: 'Пока нет сообщений',
        noMessagesDesc: 'Когда вы получите ответы от ваших кампаний, они появятся здесь.',
      },
      analyticsPage: {
        title: 'Аналитика',
        subtitle: 'Отслеживайте производительность и метрики ваших кампаний',
        overview: 'Обзор',
        campaigns: 'Кампании',
        performance: 'Производительность',
        noData: 'Нет доступных данных',
        noDataDesc: 'Начните запускать кампании, чтобы увидеть аналитические данные здесь.',
      },
      promptRegistryPage: {
        title: 'Реестр Промптов',
        subtitle: 'Управляйте и оптимизируйте ваши AI промпты во всех процессах',
        allPrompts: 'Все Промпты',
        active: 'Активные',
        pilot: 'Пилот',
        retired: 'Выведенные',
        createNew: 'Создать Промпт',
        noPrompts: 'Пока нет промптов',
        noPromptsDesc: 'Создайте ваш первый промпт для начала оптимизации AI процессов.',
        step: 'Шаг',
        version: 'Версия',
        status: 'Статус',
        description: 'Описание',
        promptId: 'ID Промпта',
        promptText: 'Текст Промпта',
      },
    },
  };

  const t = translations[language];

  const pipeline = [
    { 
      id: 'icp', 
      label: t.steps.icp.label, 
      number: 1,
      locked: false,
      description: t.steps.icp.description
    },
    { 
      id: 'hypothesis', 
      label: t.steps.hypothesis.label, 
      number: 2,
      locked: !completed.icp,
      description: t.steps.hypothesis.description
    },
    { 
      id: 'segment', 
      label: t.steps.segment.label, 
      number: 3,
      locked: !completed.hypothesis,
      description: t.steps.segment.description
    },
    { 
      id: 'enrichment', 
      label: t.steps.enrichment.label, 
      number: 4,
      locked: !completed.segment,
      description: t.steps.enrichment.description
    },
    { 
      id: 'draft', 
      label: t.steps.draft.label, 
      number: 5,
      locked: !completed.segment,
      description: t.steps.draft.description
    },
    { 
      id: 'sim', 
      label: t.steps.sim.label, 
      number: 6,
      locked: !completed.draft,
      description: t.steps.sim.description,
      comingSoon: true
    },
    { 
      id: 'send', 
      label: t.steps.send.label, 
      number: 7,
      locked: !completed.draft,
      description: t.steps.send.description
    },
  ];

  const services = [
    { name: 'Supabase', category: t.servicesModal.categories.database, status: 'connected', hasApiKey: true },
    { name: 'OpenAI', category: t.servicesModal.categories.llm, status: 'connected', hasApiKey: true },
    { name: 'Anthropic', category: t.servicesModal.categories.llm, status: 'connected', hasApiKey: true },
    { name: 'Gemini', category: t.servicesModal.categories.llm, status: 'warning', hasApiKey: false },
    { name: 'Smartlead', category: t.servicesModal.categories.delivery, status: 'connected', hasApiKey: true },
    { name: 'Sendmail', category: t.servicesModal.categories.delivery, status: 'disconnected', hasApiKey: false },
    { name: 'Exa', category: t.servicesModal.categories.enrichment, status: 'connected', hasApiKey: true },
    { name: 'Parallel', category: t.servicesModal.categories.enrichment, status: 'connected', hasApiKey: true },
    { name: 'Firecrawl', category: t.servicesModal.categories.enrichment, status: 'warning', hasApiKey: false },
    { name: 'Anysite', category: t.servicesModal.categories.enrichment, status: 'connected', hasApiKey: true },
  ];

  const languages = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'de', label: 'DE', name: 'Deutsch' },
    { code: 'ru', label: 'RU', name: 'Русский' },
  ];

  // Mock data
  const mockICPs = [
    { id: 1, name: 'B2B SaaS Founders', companies: 1240, updated: '2 days ago' },
    { id: 2, name: 'Enterprise CTOs', companies: 856, updated: '1 week ago' },
    { id: 3, name: 'Series A Marketing Leaders', companies: 432, updated: '3 days ago' },
  ];

  const mockHypotheses = [
    { id: 1, text: 'Companies raising Series A need GTM automation', confidence: 'High' },
    { id: 2, text: 'SaaS founders struggle with cold email scale', confidence: 'Medium' },
    { id: 3, text: 'Teams >10 need multi-channel outreach', confidence: 'High' },
  ];

  const mockSegments = [
    { id: 1, name: 'YC W24 Companies', size: 234, source: 'Database' },
    { id: 2, name: 'Fast-growing AI startups', size: 567, source: 'EXA' },
    { id: 3, name: 'Recent funders (30d)', size: 123, source: 'Database' },
  ];

  const colors = isDark
    ? {
        bg: '#0A0A0A',
        card: '#161616',
        cardHover: '#1E1E1E',
        text: '#FAFAFA',
        textMuted: '#A0A0A0',
        border: '#2A2A2A',
        orange: '#FF8A5B',
        orangeLight: '#2A1810',
        sidebar: '#0D0D0D',
        navSidebar: '#080808',
        pattern: '#1A1A1A',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      }
    : {
        bg: '#FAFAFA',
        card: '#FFFFFF',
        cardHover: '#FEFEFE',
        text: '#1A1A1A',
        textMuted: '#6B6B6B',
        border: '#E5E5E5',
        orange: '#FF6B35',
        orangeLight: '#FFF4F0',
        sidebar: '#F5F5F5',
        navSidebar: '#F0F0F0',
        pattern: '#E8E8E8',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
      };

  const handleSelectExisting = (type, item) => {
    setCompleted(prev => ({
      ...prev,
      [type]: item
    }));
    const currentIndex = pipeline.findIndex(s => s.id === type);
    if (currentIndex < pipeline.length - 1) {
      const nextStep = pipeline[currentIndex + 1];
      if (!nextStep.locked || type === currentStep) {
        setCurrentStep(nextStep.id);
      }
    }
  };

  // Get page title based on current page
  const renderStepContent = () => {
    switch (currentStep) {
      case 'icp':
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{t.icp.title}</h2>
              <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.6' }}>{t.icp.subtitle}</p>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.icp.chooseExisting}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {mockICPs.map(icp => (
                    <button
                      key={icp.id}
                      onClick={() => handleSelectExisting('icp', icp)}
                      style={{
                        background: colors.card,
                        border: `1px solid ${completed.icp?.id === icp.id ? colors.orange : colors.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.orange}
                      onMouseLeave={(e) => { if (completed.icp?.id !== icp.id) e.currentTarget.style.borderColor = colors.border; }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{icp.name}</div>
                      <div style={{ fontSize: '13px', color: colors.textMuted }}>
                        {icp.companies.toLocaleString()} {t.icp.companies} • {t.icp.updated}: {icp.updated}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.icp.createNew}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    onClick={() => setShowAIChat(true)}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.icp.chatWithAI}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.icp.chatDesc}</div>
                  </button>

                  <button
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.icp.quickEntry}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.icp.quickDesc}</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'hypothesis':
        if (!completed.icp) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{t.hypothesis.title}</h2>
              <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.6' }}>
                {t.hypothesis.subtitle} <span style={{ fontWeight: 600, color: colors.orange }}>{completed.icp.name}</span>
              </p>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.hypothesis.suggested}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {mockHypotheses.map(hyp => (
                    <button
                      key={hyp.id}
                      onClick={() => handleSelectExisting('hypothesis', hyp)}
                      style={{
                        background: colors.card,
                        border: `1px solid ${completed.hypothesis?.id === hyp.id ? colors.orange : colors.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.orange}
                      onMouseLeave={(e) => { if (completed.hypothesis?.id !== hyp.id) e.currentTarget.style.borderColor = colors.border; }}
                    >
                      <div style={{ fontSize: '14px', marginBottom: '8px', color: colors.text, lineHeight: '1.5' }}>{hyp.text}</div>
                      <div style={{ fontSize: '12px', color: colors.textMuted }}>
                        {t.hypothesis.confidence}: <span style={{ fontWeight: 600, color: hyp.confidence === 'High' ? colors.success : colors.warning }}>{hyp.confidence}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    onClick={() => setShowAIChat(true)}
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.icp.chatWithAI}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.hypothesis.chatDesc}</div>
                  </button>

                  <button
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.hypothesis.writeHyp}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.hypothesis.writeDesc}</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'segment':
        if (!completed.hypothesis) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{t.segment.title}</h2>
              <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
                <div><span style={{ fontWeight: 600 }}>{t.segment.subtitle}</span> {completed.icp.name}</div>
                <div><span style={{ fontWeight: 600 }}>{t.segment.hypothesis}</span> {completed.hypothesis.text}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.segment.matching}</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {mockSegments.map(seg => (
                    <button
                      key={seg.id}
                      onClick={() => handleSelectExisting('segment', seg)}
                      style={{
                        background: colors.card,
                        border: `1px solid ${completed.segment?.id === seg.id ? colors.orange : colors.border}`,
                        borderRadius: '8px',
                        padding: '16px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = colors.orange}
                      onMouseLeave={(e) => { if (completed.segment?.id !== seg.id) e.currentTarget.style.borderColor = colors.border; }}
                    >
                      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{seg.name}</div>
                      <div style={{ fontSize: '13px', color: colors.textMuted }}>
                        {seg.size.toLocaleString()} {t.icp.companies} • {t.segment.source}: {seg.source}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{t.segment.generateNew}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.segment.searchDB}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.segment.searchDesc}</div>
                  </button>

                  <button
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '20px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.cardHover; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
                  >
                    <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.segment.exaSearch}</div>
                    <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.segment.exaDesc}</div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'enrichment':
        if (!completed.segment) {
          return (
            <div style={{ textAlign: 'center', padding: '80px 40px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
            </div>
          );
        }
        return (
          <div>
            <div style={{ marginBottom: '32px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{t.enrichment.title}</h2>
              <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
                <div><span style={{ fontWeight: 600 }}>{t.enrichment.subtitle}:</span> {completed.segment.name}</div>
                <div><span style={{ fontWeight: 600 }}>{t.enrichment.from}</span> {completed.segment.source}</div>
              </div>
            </div>

            <div style={{ background: colors.orangeLight, border: `1px solid ${colors.orange}`, borderRadius: '12px', padding: '20px', marginBottom: '32px' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: colors.orange, marginBottom: '8px' }}>{t.enrichment.optional}</div>
              <div style={{ fontSize: '13px', color: colors.text, lineHeight: '1.6' }}>{t.enrichment.optionalDesc}</div>
            </div>

            <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
              <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.enrichment.companyData}</div>
                <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.enrichment.companyDesc}</div>
              </div>

              <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.enrichment.leadDetails}</div>
                <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.enrichment.leadDesc}</div>
              </div>

              <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>{t.enrichment.webIntel}</div>
                <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>{t.enrichment.webDesc}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                style={{
                  background: colors.orange,
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '14px 32px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                {t.enrichment.enrich}
              </button>

              <button
                onClick={() => setCurrentStep('draft')}
                style={{
                  background: 'transparent',
                  color: colors.textMuted,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  padding: '14px 32px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.color = colors.orange; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.color = colors.textMuted; }}
              >
                {t.enrichment.skip}
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div style={{ textAlign: 'center', padding: '80px 40px' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.locked.title}</div>
            <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.locked.subtitle}</div>
          </div>
        );
    }
  };

  // Render main content based on current page
  const renderPageContent = () => {
    if (currentPage === 'inbox') {
      return (
        <div style={{ padding: '40px', maxWidth: '1200px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{t.inboxPage.title}</h1>
            <p style={{ fontSize: '14px', color: colors.textMuted }}>{t.inboxPage.subtitle}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button style={{ background: colors.orangeLight, border: `2px solid ${colors.orange}`, color: colors.orange, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              {t.inboxPage.unread}
            </button>
            <button style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              {t.inboxPage.all}
            </button>
            <button style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              {t.inboxPage.starred}
            </button>
          </div>

          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '80px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.inboxPage.noMessages}</div>
            <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.inboxPage.noMessagesDesc}</div>
          </div>
        </div>
      );
    }

    if (currentPage === 'analytics') {
      return (
        <div style={{ padding: '40px', maxWidth: '1200px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{t.analyticsPage.title}</h1>
            <p style={{ fontSize: '14px', color: colors.textMuted }}>{t.analyticsPage.subtitle}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button style={{ background: colors.orangeLight, border: `2px solid ${colors.orange}`, color: colors.orange, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              {t.analyticsPage.overview}
            </button>
            <button style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              {t.analyticsPage.campaigns}
            </button>
            <button style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              {t.analyticsPage.performance}
            </button>
          </div>

          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '80px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.analyticsPage.noData}</div>
            <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.analyticsPage.noDataDesc}</div>
          </div>
        </div>
      );
    }

    if (currentPage === 'promptRegistry') {
      return (
        <div style={{ padding: '40px', maxWidth: '1200px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>{t.promptRegistryPage.title}</h1>
            <p style={{ fontSize: '14px', color: colors.textMuted }}>{t.promptRegistryPage.subtitle}</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
            <button style={{ background: colors.orangeLight, border: `2px solid ${colors.orange}`, color: colors.orange, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
              {t.promptRegistryPage.allPrompts}
            </button>
            <button style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              {t.promptRegistryPage.active}
            </button>
            <button style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              {t.promptRegistryPage.pilot}
            </button>
            <button style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}>
              {t.promptRegistryPage.retired}
            </button>
            <div style={{ flex: 1 }}></div>
            <button 
              disabled
              style={{ 
                background: colors.orangeLight, 
                border: `2px solid ${colors.orange}`, 
                color: colors.orange, 
                padding: '10px 20px', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: 600, 
                cursor: 'not-allowed',
                opacity: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>+</span>
              <span>{t.promptRegistryPage.createNew}</span>
              <span style={{ fontSize: '11px', fontWeight: 600, background: '#fff', color: colors.orange, padding: '2px 6px', borderRadius: '4px', marginLeft: '4px' }}>SOON</span>
            </button>
          </div>

          {/* Task Configuration */}
          <div style={{ marginBottom: '32px', background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>{t.settingsModal.taskConfig}</h3>
            <div style={{ display: 'grid', gap: '20px' }}>
              {['icpDiscovery', 'hypothesisGen', 'emailDraft', 'linkedinMsg'].map(task => (
                <div key={task}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px', color: colors.text }}>{t.settingsModal.tasks[task]}</div>
                  
                  {/* Column Headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textMuted, paddingLeft: '4px' }}>{t.settingsModal.provider}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textMuted, paddingLeft: '4px' }}>{t.settingsModal.model}</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: colors.textMuted, paddingLeft: '4px' }}>{t.settingsModal.prompt}</div>
                  </div>
                  
                  {/* Selects */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <select style={{ background: colors.sidebar, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: colors.text, cursor: 'pointer' }}>
                      <option>OpenAI</option>
                      <option>Anthropic</option>
                      <option>Gemini</option>
                    </select>
                    <select style={{ background: colors.sidebar, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: colors.text, cursor: 'pointer' }}>
                      <option>GPT-4</option>
                      <option>GPT-3.5</option>
                      <option>Claude 3</option>
                    </select>
                    <select style={{ background: colors.sidebar, border: `1px solid ${colors.border}`, borderRadius: '8px', padding: '10px 14px', fontSize: '14px', color: colors.text, cursor: 'pointer' }}>
                      <option value="">Select prompt...</option>
                      <option>v1.2 - ICP Discovery Base</option>
                      <option>v1.3 - ICP Discovery Enhanced</option>
                      <option>v2.1 - Hypothesis Builder</option>
                      <option>v3.0 - Email Personalization</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prompt Registry Table */}
          <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: colors.sidebar, padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, display: 'grid', gridTemplateColumns: '120px 100px 100px 1fr 180px', gap: '16px', fontSize: '13px', fontWeight: 600, color: colors.textMuted }}>
              <div>{t.promptRegistryPage.promptId}</div>
              <div>{t.promptRegistryPage.step}</div>
              <div>{t.promptRegistryPage.version}</div>
              <div>{t.promptRegistryPage.description}</div>
              <div>{t.promptRegistryPage.status}</div>
            </div>
            
            {/* Empty State */}
            <div style={{ padding: '80px 40px', textAlign: 'center' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: colors.textMuted, marginBottom: '8px' }}>{t.promptRegistryPage.noPrompts}</div>
              <div style={{ fontSize: '14px', color: colors.textMuted }}>{t.promptRegistryPage.noPromptsDesc}</div>
            </div>
          </div>

          {/* API Endpoints Info */}
          <div style={{ marginTop: '32px', background: colors.sidebar, border: `1px solid ${colors.border}`, borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Available API Endpoints</h3>
              <span style={{ fontSize: '11px', fontWeight: 600, color: colors.orange, background: colors.orangeLight, padding: '2px 8px', borderRadius: '4px' }}>COMING SOON</span>
            </div>
            <div style={{ display: 'grid', gap: '12px', fontSize: '13px', color: colors.textMuted }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.success, fontFamily: 'monospace' }}>GET</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry</span>
                <span>— List all prompts (filter by step)</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.warning, fontFamily: 'monospace' }}>POST</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry</span>
                <span>— Create new prompt entry</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.success, fontFamily: 'monospace' }}>GET</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry/active</span>
                <span>— Get active prompt for step</span>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontWeight: 600, color: colors.warning, fontFamily: 'monospace' }}>POST</span>
                <span style={{ fontFamily: 'monospace' }}>/api/prompt-registry/active</span>
                <span>— Set active prompt for step</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Pipeline view - show pipeline steps and configuration sidebar
    return (
      <>
        {/* Pipeline Steps Bar */}
        <div style={{ background: colors.sidebar, borderBottom: `1px solid ${colors.border}`, padding: '20px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pipeline.map((step, index) => (
              <div key={step.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <button
                  onClick={() => !step.locked && !step.comingSoon && setCurrentStep(step.id)}
                  disabled={step.locked || step.comingSoon}
                  style={{
                    background: completed[step.id] ? colors.orange : currentStep === step.id ? colors.orangeLight : 'transparent',
                    border: `2px solid ${completed[step.id] || currentStep === step.id ? colors.orange : colors.border}`,
                    color: completed[step.id] ? '#FFF' : currentStep === step.id ? colors.orange : step.locked || step.comingSoon ? colors.textMuted : colors.text,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: step.locked || step.comingSoon ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: currentStep === step.id ? 600 : 500,
                    opacity: step.locked || step.comingSoon ? 0.5 : 1,
                    transition: 'all 0.2s ease',
                    width: '100%',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                  }}
                >
                  <div>{step.number}. {step.label}</div>
                  {step.comingSoon && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-8px',
                      background: colors.warning,
                      color: '#FFF',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.3px',
                    }}>
                      Soon
                    </div>
                  )}
                </button>
                {index < pipeline.length - 1 && (
                  <div style={{ width: '16px', height: '2px', background: completed[pipeline[index + 1].id] ? colors.orange : colors.border, margin: '0 4px' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main Content with Sidebar */}
        <div style={{ display: 'flex', flex: 1 }}>
          {/* Configuration Sidebar */}
          <div style={{ width: '320px', background: colors.sidebar, borderRight: `1px solid ${colors.border}`, padding: '32px 24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: colors.textMuted, marginBottom: '24px' }}>
              {t.currentConfig}
            </h3>

            <div style={{ display: 'grid', gap: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px', fontWeight: 600 }}>
                  {t.steps.icp.label}
                </div>
                {completed.icp ? (
                  <div style={{ background: colors.card, border: `1px solid ${colors.orange}`, borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 500 }}>
                    {completed.icp.name}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: colors.textMuted, fontStyle: 'italic' }}>
                    {t.notSelected}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px', fontWeight: 600 }}>
                  {t.steps.hypothesis.label}
                </div>
                {completed.hypothesis ? (
                  <div style={{ background: colors.card, border: `1px solid ${colors.orange}`, borderRadius: '8px', padding: '12px', fontSize: '13px', lineHeight: '1.5' }}>
                    {completed.hypothesis.text}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: colors.textMuted, fontStyle: 'italic' }}>
                    {t.notSelected}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '8px', fontWeight: 600 }}>
                  {t.steps.segment.label}
                </div>
                {completed.segment ? (
                  <div style={{ background: colors.card, border: `1px solid ${colors.orange}`, borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 500 }}>
                    {completed.segment.name}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: colors.textMuted, fontStyle: 'italic' }}>
                    {t.notSelected}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Workspace */}
          <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
            {renderStepContent()}
          </div>
        </div>
      </>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: colors.bg,
        color: colors.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        transition: 'all 0.3s ease',
        display: 'flex',
      }}
      onClick={() => showLanguageMenu && setShowLanguageMenu(false)}
    >
      {/* Left Navigation Sidebar */}
      <div style={{
        width: sidebarExpanded ? '240px' : '72px',
        background: colors.navSidebar,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
      }}>
        {/* Logo Section - aligned with Top Bar */}
        <div style={{ 
          height: '110px', // Fixed height to match Top Bar content area
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            background: colors.orange, 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 700,
            color: '#FFF'
          }}>
            C5
          </div>
        </div>

        {/* Navigation Section - starts below separator */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: '20px', paddingBottom: '20px' }}>
          {/* Main Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px' }}>
          <button
            onClick={() => setCurrentPage('pipeline')}
            style={{
              background: currentPage === 'pipeline' ? colors.orangeLight : 'transparent',
              border: `2px solid ${currentPage === 'pipeline' ? colors.orange : 'transparent'}`,
              color: currentPage === 'pipeline' ? colors.orange : colors.textMuted,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.title}
            onMouseEnter={(e) => { if (currentPage !== 'pipeline') e.currentTarget.style.backgroundColor = colors.cardHover; }}
            onMouseLeave={(e) => { if (currentPage !== 'pipeline') e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {sidebarExpanded ? t.navPipeline : 'P'}
          </button>

          <button
            onClick={() => setCurrentPage('inbox')}
            style={{
              background: currentPage === 'inbox' ? colors.orangeLight : 'transparent',
              border: `2px solid ${currentPage === 'inbox' ? colors.orange : 'transparent'}`,
              color: currentPage === 'inbox' ? colors.orange : colors.textMuted,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.inbox}
            onMouseEnter={(e) => { if (currentPage !== 'inbox') e.currentTarget.style.backgroundColor = colors.cardHover; }}
            onMouseLeave={(e) => { if (currentPage !== 'inbox') e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {sidebarExpanded ? t.navInbox : 'I'}
          </button>

          <button
            onClick={() => setCurrentPage('analytics')}
            style={{
              background: currentPage === 'analytics' ? colors.orangeLight : 'transparent',
              border: `2px solid ${currentPage === 'analytics' ? colors.orange : 'transparent'}`,
              color: currentPage === 'analytics' ? colors.orange : colors.textMuted,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.analytics}
            onMouseEnter={(e) => { if (currentPage !== 'analytics') e.currentTarget.style.backgroundColor = colors.cardHover; }}
            onMouseLeave={(e) => { if (currentPage !== 'analytics') e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {sidebarExpanded ? t.navAnalytics : 'A'}
          </button>

          <button
            onClick={() => setCurrentPage('promptRegistry')}
            style={{
              background: currentPage === 'promptRegistry' ? colors.orangeLight : 'transparent',
              border: `2px solid ${currentPage === 'promptRegistry' ? colors.orange : 'transparent'}`,
              color: currentPage === 'promptRegistry' ? colors.orange : colors.textMuted,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.promptRegistry}
            onMouseEnter={(e) => { if (currentPage !== 'promptRegistry') e.currentTarget.style.backgroundColor = colors.cardHover; }}
            onMouseLeave={(e) => { if (currentPage !== 'promptRegistry') e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            {sidebarExpanded ? t.navPromptRegistry : 'PR'}
          </button>
        </div>

        {/* Bottom: Collapse Toggle, Settings & Services */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px', borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
          {/* Toggle Button */}
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.textMuted,
              width: sidebarExpanded ? '216px' : '48px',
              height: '40px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'space-between' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              paddingRight: sidebarExpanded ? '16px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 500,
              marginBottom: '8px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.orangeLight; e.currentTarget.style.color = colors.orange; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; e.currentTarget.style.color = colors.textMuted; }}
          >
            {sidebarExpanded ? (
              <>
                <span>{t.collapseNav}</span>
                <span>←</span>
              </>
            ) : (
              <span>→</span>
            )}
          </button>

          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              gap: sidebarExpanded ? '12px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.settings}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.orangeLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
          >
            <span>⚙</span>
            {sidebarExpanded && <span style={{ fontWeight: 600 }}>{t.settings}</span>}
          </button>

          <button
            onClick={() => setShowServices(true)}
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              color: colors.text,
              width: sidebarExpanded ? '216px' : '48px',
              height: '48px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: sidebarExpanded ? '15px' : '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              paddingLeft: sidebarExpanded ? '16px' : '0',
              gap: sidebarExpanded ? '12px' : '0',
              transition: 'all 0.2s ease',
              fontWeight: 600,
            }}
            title={t.services}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.orange; e.currentTarget.style.backgroundColor = colors.orangeLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.backgroundColor = colors.card; }}
          >
            <span>🔌</span>
            {sidebarExpanded && <span style={{ fontWeight: 600 }}>{t.services}</span>}
          </button>
        </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar with Hero Header */}
        <div style={{ 
          height: '110px', // Fixed height to match Logo section
          background: colors.sidebar, 
          borderBottom: `1px solid ${colors.border}`, 
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '32px' }}>
            {/* Left: Hero Text */}
            <div style={{ flex: 1 }}>
              <h1 style={{
                fontSize: '28px',
                fontWeight: 700,
                marginBottom: '8px',
                lineHeight: '1.2',
              }}>
                {t.hero.title1}
                <span style={{ color: colors.orange }}>{t.hero.title2}</span>
                {t.hero.title3}
              </h1>
              <p style={{
                fontSize: '14px',
                color: colors.textMuted,
                lineHeight: '1.5',
              }}>
                {t.hero.subtitle}
              </p>
            </div>

            {/* Right: Controls */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
              {/* Future: User profile/login button will go here */}

              {/* Language Selector */}
              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowLanguageMenu(!showLanguageMenu)}
                  style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, width: '52px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {languages.find(l => l.code === language)?.label}
                </button>
                {showLanguageMenu && (
                  <div style={{ position: 'absolute', top: '48px', right: 0, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px', zIndex: 200 }}>
                    {languages.map(lang => (
                      <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setShowLanguageMenu(false); }}
                        style={{
                          width: '100%',
                          background: language === lang.code ? colors.orangeLight : 'transparent',
                          border: 'none',
                          color: language === lang.code ? colors.orange : colors.text,
                          padding: '12px 16px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: language === lang.code ? 600 : 500,
                          borderBottom: `1px solid ${colors.border}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                        }}
                        onMouseEnter={(e) => { if (language !== lang.code) e.currentTarget.style.backgroundColor = colors.cardHover; }}
                        onMouseLeave={(e) => { if (language !== lang.code) e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsDark(!isDark)}
                style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isDark ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {renderPageContent()}
        </div>
      </div>

      {/* AI Chat Modal */}
      {showAIChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: colors.card, borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{t.aiChat.title}</h3>
                <button onClick={() => setShowAIChat(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '24px', cursor: 'pointer', padding: '0', width: '32px', height: '32px' }}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <div style={{ background: colors.sidebar, borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: colors.text }}>
                  {t.aiChat.greeting} <span style={{ fontWeight: 600, color: colors.orange }}>{currentStep}</span>. {t.aiChat.greeting2}
                </p>
              </div>
            </div>

            <div style={{ padding: '24px', borderTop: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder={t.aiChat.placeholder}
                  style={{
                    flex: 1,
                    background: colors.sidebar,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: '12px 16px',
                    fontSize: '14px',
                    color: colors.text,
                    outline: 'none',
                  }}
                />
                <button
                  style={{
                    background: colors.orange,
                    color: '#FFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {t.aiChat.send}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: colors.card, borderRadius: '16px', width: '90%', maxWidth: '800px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{t.settingsModal.title}</h3>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '24px', cursor: 'pointer', padding: '0', width: '32px', height: '32px' }}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              {/* Service Providers - Unified */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '16px', fontWeight: 600 }}>Service Providers</h4>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: colors.orange, background: colors.orangeLight, padding: '2px 8px', borderRadius: '4px' }}>COMING SOON</span>
                </div>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {services.map(service => {
                    const statusIcon = service.status === 'connected' ? '🟢' : service.status === 'warning' ? '🟡' : '🔴';
                    return (
                      <div key={service.name} style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px 16px', 
                        background: colors.sidebar, 
                        borderRadius: '8px', 
                        border: `1px solid ${colors.border}` 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <span style={{ fontSize: '14px' }}>{statusIcon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600 }}>{service.name}</div>
                            <div style={{ fontSize: '11px', color: colors.textMuted }}>{service.category}</div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {service.hasApiKey ? (
                            <>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                color: '#22c55e', 
                                background: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.2)', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}>
                                ✓ in .env
                              </span>
                              <label style={{ 
                                position: 'relative', 
                                display: 'inline-block', 
                                width: '44px', 
                                height: '24px', 
                                cursor: 'not-allowed', 
                                opacity: 0.5 
                              }}>
                                <input type="checkbox" checked={service.status === 'connected'} disabled style={{ opacity: 0, width: 0, height: 0 }} />
                                <span style={{ 
                                  position: 'absolute', 
                                  cursor: 'not-allowed',
                                  inset: 0, 
                                  background: service.status === 'connected' ? '#22c55e' : colors.border, 
                                  borderRadius: '24px', 
                                  transition: 'background 0.3s' 
                                }}></span>
                                <span style={{ 
                                  position: 'absolute', 
                                  left: service.status === 'connected' ? '22px' : '2px', 
                                  top: '2px', 
                                  width: '20px', 
                                  height: '20px', 
                                  background: '#FFF', 
                                  borderRadius: '50%', 
                                  transition: 'left 0.3s' 
                                }}></span>
                              </label>
                            </>
                          ) : (
                            <>
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 600, 
                                color: '#ef4444', 
                                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.2)', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                whiteSpace: 'nowrap'
                              }}>
                                ⚠️ missing
                              </span>
                              <button
                                disabled
                                style={{
                                  background: colors.orangeLight,
                                  border: `1px solid ${colors.orange}`,
                                  color: colors.orange,
                                  padding: '6px 16px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'not-allowed',
                                  opacity: 0.6,
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                Set up
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Modal */}
      {showServices && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: colors.card, borderRadius: '16px', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{t.servicesModal.title}</h3>
                <button onClick={() => setShowServices(false)} style={{ background: 'none', border: 'none', color: colors.textMuted, fontSize: '24px', cursor: 'pointer', padding: '0', width: '32px', height: '32px' }}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gap: '12px' }}>
                {services.map(service => {
                  const statusColor = service.status === 'connected' ? colors.success : service.status === 'warning' ? colors.warning : colors.error;
                  return (
                    <div key={service.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: colors.sidebar, borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{service.name}</div>
                        <div style={{ fontSize: '12px', color: colors.textMuted }}>{service.category}</div>
                      </div>
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: statusColor }} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
