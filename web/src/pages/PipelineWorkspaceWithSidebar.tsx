// @ts-nocheck
import { useEffect, useState } from 'react';

import {
  fetchServices,
  fetchIcpProfiles,
  fetchIcpHypotheses,
  fetchSegments,
  fetchCampaigns,
  createCampaign,
  fetchSmartleadCampaigns,
  triggerDraftGenerate,
  triggerSmartleadSend,
  enqueueSegmentEnrichment,
  enqueueSegmentEnrichmentMulti,
  fetchEnrichmentStatus,
  fetchEnrichmentSettings,
  saveEnrichmentSettings,
  triggerIcpDiscovery,
  generateIcpProfileViaCoach,
  generateHypothesisViaCoach,
  createIcpProfile,
  createIcpHypothesis,
  fetchPromptRegistry,
  createPromptRegistryEntry,
  setActivePrompt,
  fetchAnalyticsSummary,
  fetchAnalyticsOptimize,
  type ServiceConfig,
  type PromptEntry,
  type PromptStep,
  fetchLlmModels,
  createSegmentAPI,
  snapshotSegment,
  saveExaSegmentAPI,
} from '../apiClient';
import { SegmentBuilder } from '../components/SegmentBuilder';
import { ExaWebsetSearch } from '../components/ExaWebsetSearch';
import { loadSettings, saveSettings, type Settings } from '../hooks/useSettingsStore';
import { getWorkspaceColors } from '../theme';
import CampaignOperatorDesk from './CampaignOperatorDesk';
import {
  LegacyWorkspaceSidebar,
  LegacyWorkspaceTopbar,
} from './legacyWorkspace/LegacyWorkspaceChrome';
import { LegacyAiChatModal } from './legacyWorkspace/LegacyAiChatModal';
import { LegacyAnalyticsPage } from './legacyWorkspace/LegacyAnalyticsPage';
import { LegacyInboxPage } from './legacyWorkspace/LegacyInboxPage';
import { LegacyPromptRegistryPage } from './legacyWorkspace/LegacyPromptRegistryPage';
import { LegacyPipelineStepRouter } from './legacyWorkspace/LegacyPipelineStepRouter';
import { LegacyPipelineShell } from './legacyWorkspace/LegacyPipelineShell';
import { LegacyWorkspaceServicesModal } from './legacyWorkspace/LegacyWorkspaceServicesModal';
import { LegacyWorkspaceSettingsModal } from './legacyWorkspace/LegacyWorkspaceSettingsModal';
import {
  buildDraftGenerateOptions,
  formatDraftSummary,
  formatSendSummary,
  getActivePromptIdForStep,
  hasLiveDraftsReady,
} from './legacyWorkspace/legacyWorkspaceMetrics';
import {
  applyActivePromptSelection,
  mapTaskToProviderKey,
  setTaskPrompt,
  type TaskPromptsState,
} from './legacyWorkspace/legacyWorkspacePromptHelpers';
import type {
  PromptRegistryCreateFormState,
  PromptRegistryFilterStatus,
} from './legacyWorkspace/legacyWorkspaceTypes';
import {
  appendChatMessage,
  appendInteractiveCoachMessage,
  applyCoachResultToState,
  buildDiscoveryLinkParams,
  buildHypothesisSummaryFromSearchConfig,
  buildIcpSummaryFromProfile,
  buildInteractiveHypothesisPrompt,
  buildInteractiveIcpPrompt,
  formatHypothesisSummaryForChat,
  formatIcpSummaryForChat,
  getPersistedDiscoveryRun,
  hasPersistedDiscoveryRun,
  openIcpDiscoveryForLatestRun,
  persistLatestDiscoveryRun,
  resolveCoachRunMode,
} from './legacyWorkspace/legacyWorkspaceCoachHelpers';
import {
  buildFallbackEnrichmentSettings,
  isEnrichmentProviderReadyForServices,
  normalizeEnrichmentSettings,
  toggleEnrichmentProviderSelection,
} from './legacyWorkspace/legacyWorkspaceEnrichmentHelpers';
import {
  prepareSmartleadCampaignSync,
  runEnrichmentJob,
} from './legacyWorkspace/legacyWorkspaceDeliveryActions';
import { generateDraftsForCampaign } from './legacyWorkspace/legacyWorkspaceDraftActions';
import {
  createSegmentAndRefresh,
  saveExaSegmentAndRefresh,
} from './legacyWorkspace/legacyWorkspaceSegmentActions';

export function buildPromptCreateEntry(form: {
  id: string;
  version?: string;
  description?: string;
  rollout_status?: 'pilot' | 'active' | 'retired' | 'deprecated' | null;
  prompt_text?: string;
}) {
  const trimmedId = (form.id ?? '').trim();
  return {
    id: trimmedId,
    version: form.version ? form.version.trim() : undefined,
    description: form.description ? form.description.trim() : undefined,
    rollout_status: form.rollout_status ?? 'pilot',
    prompt_text: form.prompt_text && form.prompt_text.trim().length > 0 ? form.prompt_text.trim() : undefined,
  };
}

export function mapEnrichmentErrorMessage(err: unknown): string {
  const raw =
    (err as any)?.message ??
    (typeof err === 'string' ? err : '') ??
    '';
  if (
    typeof raw === 'string' &&
    raw.includes('No segment members found for finalized segment')
  ) {
    return 'Selected segment has no finalized members yet. Create or refresh a snapshot (or add members) before running enrichment.';
  }
  return raw || 'Failed to enqueue enrichment';
}

export function mapLlmModelsErrorMessage(err: unknown): string {
  const raw =
    (err as any)?.message ??
    (typeof err === 'string' ? err : '') ??
    '';
  if (!raw) {
    return 'Failed to list models';
  }
  const match = /^API error \d+:\s*(.*)$/.exec(raw);
  if (match && match[1]) {
    return match[1];
  }
  return raw;
}


/**
 * GTM Workspace with Left Sidebar Navigation (Option B)
 * Main navigation: Pipeline | Inbox | Analytics
 * Supports: English, Spanish, French, German, Russian
 */

type PipelineWorkspaceProps = {
  apiBase: string;
  modeLabel: string;
  supabaseReady: boolean;
  smartleadReady: boolean;
  initialPage?: 'pipeline' | 'campaigns' | 'inbox' | 'analytics' | 'promptRegistry';
};

	export default function PipelineWorkspaceWithSidebar({
  apiBase,
  modeLabel,
  supabaseReady,
  smartleadReady,
  initialPage = 'pipeline',
}: PipelineWorkspaceProps) {
  const [isDark, setIsDark] = useState(false);
  const [currentPage, setCurrentPage] = useState<'pipeline' | 'campaigns' | 'inbox' | 'analytics' | 'promptRegistry'>(initialPage);
  const [currentStep, setCurrentStep] = useState('icp');
  const [showAIChat, setShowAIChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showServices, setShowServices] = useState(false);
  const [showSegmentBuilder, setShowSegmentBuilder] = useState(false);
  const [showExaWebsetSearch, setShowExaWebsetSearch] = useState(false);
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

  const [services, setServices] = useState<ServiceConfig[]>([]);
  const enrichmentProviderOptions = [
    { id: 'exa', label: 'EXA', serviceName: 'Exa' },
    { id: 'parallel', label: 'Parallel', serviceName: 'Parallel' },
    { id: 'firecrawl', label: 'Firecrawl', serviceName: 'Firecrawl' },
    { id: 'anysite', label: 'Anysite', serviceName: 'Anysite' },
    { id: 'mock', label: 'Mock', serviceName: null },
  ] as const;
  const [enrichmentSettings, setEnrichmentSettingsState] = useState<any | null>(null);
  const [enrichmentSettingsBusy, setEnrichmentSettingsBusy] = useState(false);
  const [enrichmentSettingsError, setEnrichmentSettingsError] = useState<string | null>(null);
  const [selectedEnrichmentProviders, setSelectedEnrichmentProviders] = useState<string[]>([]);
  const [enrichResults, setEnrichResults] = useState<any[] | null>(null);
  const [icpProfiles, setIcpProfiles] = useState<any[]>([]);
  const [hypotheses, setHypotheses] = useState<any[]>([]);
  const [segments, setSegments] = useState<any[]>([]);
  const [aiMessage, setAiMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [newIcpName, setNewIcpName] = useState('');
  const [newIcpDescription, setNewIcpDescription] = useState('');
  const [newHypothesisLabel, setNewHypothesisLabel] = useState('');
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [newCampaignName, setNewCampaignName] = useState<string>('');
  const [campaignCreateBusy, setCampaignCreateBusy] = useState(false);
  const [campaignCreateError, setCampaignCreateError] = useState<string | null>(null);
  const [draftLimit, setDraftLimit] = useState<number>(50);
  const [draftDryRun, setDraftDryRun] = useState<boolean>(true);
  const [dataQualityMode, setDataQualityMode] = useState<'strict' | 'graceful'>('strict');
  const [interactionMode, setInteractionMode] = useState<'express' | 'coach'>('express');
  const [draftSummary, setDraftSummary] = useState<string | null>(null);
  const [smartleadCampaigns, setSmartleadCampaigns] = useState<any[]>([]);
  const [selectedSmartleadCampaignId, setSelectedSmartleadCampaignId] = useState<string>('');
  const [sendSummary, setSendSummary] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendDryRun, setSendDryRun] = useState(true);
  const [sendBatchSize, setSendBatchSize] = useState<number>(25);
  const [promptEntries, setPromptEntries] = useState<PromptEntry[]>([]);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [taskPrompts, setTaskPrompts] = useState<TaskPromptsState>(() => {
    return (settings.taskPrompts ?? {}) as TaskPromptsState;
  });
  const [promptFilterStatus, setPromptFilterStatus] = useState<PromptRegistryFilterStatus>('all');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [showPromptCreate, setShowPromptCreate] = useState(false);
  const [promptCreateForm, setPromptCreateForm] = useState<PromptRegistryCreateFormState>({
    id: '',
    step: 'draft' as PromptStep,
    version: 'v1',
    description: '',
    rollout_status: 'pilot',
    prompt_text: '',
  });
  const [analyticsRows, setAnalyticsRows] = useState<any[]>([]);
  const [analyticsSuggestions, setAnalyticsSuggestions] = useState<any[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<'icp' | 'segment' | 'pattern' | 'offer' | 'hypothesis' | 'recipient_type' | 'sender_identity'>('icp');
  const [inboxMessages, setInboxMessages] = useState<any[]>([]);
  const [inboxFilter, setInboxFilter] = useState<'unread' | 'all' | 'starred'>('unread');
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [llmModels, setLlmModels] = useState<Record<string, string[] | undefined>>({});
  const [llmModelsError, setLlmModelsError] = useState<Record<string, string | undefined>>({});
  const [aiTranscript, setAiTranscript] = useState<any[]>([]);

  useEffect(() => {
    const providers: Array<'openai' | 'anthropic'> = ['openai', 'anthropic'];
    providers.forEach((provider) => {
      if (llmModels[provider] || llmModelsError[provider]) return;
      fetchLlmModels(provider)
        .then((models) => {
          const ids = (models ?? []).map((m) => m.id).filter(Boolean);
          setLlmModels((prev) => ({ ...prev, [provider]: ids }));
        })
        .catch((err: any) => {
          setLlmModelsError((prev) => ({
            ...prev,
            [provider]: mapLlmModelsErrorMessage(err),
          }));
        });
    });
  }, [llmModels, llmModelsError]);

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
      campaigns: 'Campaigns',
      inbox: 'Inbox',
      analytics: 'Analytics',
      promptRegistry: 'Prompt Registry',
      navPipeline: 'Pipeline',
      navCampaigns: 'Campaigns',
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
        builderTitle: 'Build Segment',
        segmentName: 'Segment Name',
        segmentNamePlaceholder: 'e.g., Enterprise CTOs',
        aiAssisted: 'AI-Assisted Filter Builder',
        aiPlaceholder: 'Describe your target audience (e.g., \'Enterprise CTOs in SaaS companies with 100+ employees\')',
        generateSuggestions: 'Generate Suggestions',
        generating: 'Generating...',
        filters: 'Filters',
        addFilter: 'Add Filter',
        preview: 'Preview',
        loadingPreview: 'Loading preview...',
        addFiltersPreview: 'Add filters to see preview',
        matches: 'Matches',
        companies: 'companies',
        employees: 'employees',
        total: 'total',
        warningNoMatches: 'Warning: No contacts match these filters',
        validationErrors: 'Validation Errors:',
        cancel: 'Cancel',
        createSegment: 'Create Segment',
        creating: 'Creating...',
        exaTitle: 'EXA Web Search',
        searchDescription: 'Search Description',
        searchPlaceholder: 'Describe the companies or people you want to find (e.g., \'CTOs at enterprise SaaS companies in San Francisco\')',
        search: 'Search',
        searching: 'Searching...',
        searchResults: 'Search Results',
        found: 'Found',
        companiesTab: 'Companies',
        employeesTab: 'Employees',
        noCompanies: 'No companies found',
        noEmployees: 'No employees found',
        saveAsSegment: 'Save as Segment',
        saving: 'Saving...',
        exaSegmentPlaceholder: 'e.g., Enterprise CTOs from EXA Search',
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
        builderTitle: 'Construir Segmento',
        segmentName: 'Nombre del Segmento',
        segmentNamePlaceholder: 'ej., CTOs Empresariales',
        aiAssisted: 'Constructor de Filtros Asistido por IA',
        aiPlaceholder: 'Describe tu audiencia objetivo (ej., \'CTOs empresariales en compañías SaaS con más de 100 empleados\')',
        generateSuggestions: 'Generar Sugerencias',
        generating: 'Generando...',
        filters: 'Filtros',
        addFilter: 'Agregar Filtro',
        preview: 'Vista Previa',
        loadingPreview: 'Cargando vista previa...',
        addFiltersPreview: 'Agrega filtros para ver la vista previa',
        matches: 'Coincidencias',
        companies: 'empresas',
        employees: 'empleados',
        total: 'total',
        warningNoMatches: 'Advertencia: Ningún contacto coincide con estos filtros',
        validationErrors: 'Errores de Validación:',
        cancel: 'Cancelar',
        createSegment: 'Crear Segmento',
        creating: 'Creando...',
        exaTitle: 'Búsqueda Web EXA',
        searchDescription: 'Descripción de Búsqueda',
        searchPlaceholder: 'Describe las empresas o personas que quieres encontrar (ej., \'CTOs en empresas SaaS empresariales en San Francisco\')',
        search: 'Buscar',
        searching: 'Buscando...',
        searchResults: 'Resultados de Búsqueda',
        found: 'Encontrado',
        companiesTab: 'Empresas',
        employeesTab: 'Empleados',
        noCompanies: 'No se encontraron empresas',
        noEmployees: 'No se encontraron empleados',
        saveAsSegment: 'Guardar como Segmento',
        saving: 'Guardando...',
        exaSegmentPlaceholder: 'ej., CTOs Empresariales de Búsqueda EXA',
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
        builderTitle: 'Construire le Segment',
        segmentName: 'Nom du Segment',
        segmentNamePlaceholder: 'ex., CTOs d\'Entreprise',
        aiAssisted: 'Constructeur de Filtres Assisté par IA',
        aiPlaceholder: 'Décrivez votre audience cible (ex., \'CTOs d\'entreprise dans des sociétés SaaS avec plus de 100 employés\')',
        generateSuggestions: 'Générer des Suggestions',
        generating: 'Génération...',
        filters: 'Filtres',
        addFilter: 'Ajouter un Filtre',
        preview: 'Aperçu',
        loadingPreview: 'Chargement de l\'aperçu...',
        addFiltersPreview: 'Ajoutez des filtres pour voir l\'aperçu',
        matches: 'Correspondances',
        companies: 'entreprises',
        employees: 'employés',
        total: 'total',
        warningNoMatches: 'Attention: Aucun contact ne correspond à ces filtres',
        validationErrors: 'Erreurs de Validation:',
        cancel: 'Annuler',
        createSegment: 'Créer le Segment',
        creating: 'Création...',
        exaTitle: 'Recherche Web EXA',
        searchDescription: 'Description de la Recherche',
        searchPlaceholder: 'Décrivez les entreprises ou personnes que vous souhaitez trouver (ex., \'CTOs dans des entreprises SaaS à San Francisco\')',
        search: 'Rechercher',
        searching: 'Recherche...',
        searchResults: 'Résultats de Recherche',
        found: 'Trouvé',
        companiesTab: 'Entreprises',
        employeesTab: 'Employés',
        noCompanies: 'Aucune entreprise trouvée',
        noEmployees: 'Aucun employé trouvé',
        saveAsSegment: 'Enregistrer comme Segment',
        saving: 'Enregistrement...',
        exaSegmentPlaceholder: 'ex., CTOs d\'Entreprise de Recherche EXA',
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
        builderTitle: 'Segment Erstellen',
        segmentName: 'Segmentname',
        segmentNamePlaceholder: 'z.B., Enterprise CTOs',
        aiAssisted: 'KI-Unterstützter Filter-Builder',
        aiPlaceholder: 'Beschreiben Sie Ihre Zielgruppe (z.B., \'Enterprise CTOs in SaaS-Unternehmen mit über 100 Mitarbeitern\')',
        generateSuggestions: 'Vorschläge Generieren',
        generating: 'Generierung...',
        filters: 'Filter',
        addFilter: 'Filter Hinzufügen',
        preview: 'Vorschau',
        loadingPreview: 'Vorschau laden...',
        addFiltersPreview: 'Filter hinzufügen, um Vorschau zu sehen',
        matches: 'Übereinstimmungen',
        companies: 'Unternehmen',
        employees: 'Mitarbeiter',
        total: 'gesamt',
        warningNoMatches: 'Warnung: Keine Kontakte entsprechen diesen Filtern',
        validationErrors: 'Validierungsfehler:',
        cancel: 'Abbrechen',
        createSegment: 'Segment Erstellen',
        creating: 'Erstellen...',
        exaTitle: 'EXA Websuche',
        searchDescription: 'Suchbeschreibung',
        searchPlaceholder: 'Beschreiben Sie die Unternehmen oder Personen, die Sie finden möchten (z.B., \'CTOs in Enterprise-SaaS-Unternehmen in San Francisco\')',
        search: 'Suchen',
        searching: 'Suchen...',
        searchResults: 'Suchergebnisse',
        found: 'Gefunden',
        companiesTab: 'Unternehmen',
        employeesTab: 'Mitarbeiter',
        noCompanies: 'Keine Unternehmen gefunden',
        noEmployees: 'Keine Mitarbeiter gefunden',
        saveAsSegment: 'Als Segment Speichern',
        saving: 'Speichern...',
        exaSegmentPlaceholder: 'z.B., Enterprise CTOs aus EXA-Suche',
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
      campaigns: 'Кампании',
      inbox: 'Входящие',
      analytics: 'Аналитика',
      promptRegistry: 'Реестр промптов',
      navPipeline: 'Воронка',
      navCampaigns: 'Кампании',
      navInbox: 'Входящие',
      navAnalytics: 'Аналитика',
      navPromptRegistry: 'Промпты',
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
        builderTitle: 'Создать Сегмент',
        segmentName: 'Название Сегмента',
        segmentNamePlaceholder: 'напр., Корпоративные CTO',
        aiAssisted: 'Конструктор Фильтров с ИИ',
        aiPlaceholder: 'Опишите вашу целевую аудиторию (напр., \'Корпоративные CTO в SaaS-компаниях с более чем 100 сотрудниками\')',
        generateSuggestions: 'Сгенерировать Предложения',
        generating: 'Генерация...',
        filters: 'Фильтры',
        addFilter: 'Добавить Фильтр',
        preview: 'Предпросмотр',
        loadingPreview: 'Загрузка предпросмотра...',
        addFiltersPreview: 'Добавьте фильтры для предпросмотра',
        matches: 'Совпадения',
        companies: 'компании',
        employees: 'сотрудники',
        total: 'всего',
        warningNoMatches: 'Предупреждение: Нет контактов, соответствующих этим фильтрам',
        validationErrors: 'Ошибки Валидации:',
        cancel: 'Отмена',
        createSegment: 'Создать Сегмент',
        creating: 'Создание...',
        exaTitle: 'Веб-Поиск EXA',
        searchDescription: 'Описание Поиска',
        searchPlaceholder: 'Опишите компании или людей, которых вы хотите найти (напр., \'CTO в корпоративных SaaS-компаниях в Сан-Франциско\')',
        search: 'Поиск',
        searching: 'Поиск...',
        searchResults: 'Результаты Поиска',
        found: 'Найдено',
        companiesTab: 'Компании',
        employeesTab: 'Сотрудники',
        noCompanies: 'Компании не найдены',
        noEmployees: 'Сотрудники не найдены',
        saveAsSegment: 'Сохранить как Сегмент',
        saving: 'Сохранение...',
        exaSegmentPlaceholder: 'напр., Корпоративные CTO из Поиска EXA',
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
  const navItems: Array<{
    page: 'pipeline' | 'campaigns' | 'inbox' | 'analytics' | 'promptRegistry';
    label: string;
    short: string;
    title: string;
  }> = [
    { page: 'pipeline', label: t.navPipeline, short: 'P', title: t.title },
    { page: 'campaigns', label: t.navCampaigns, short: 'C', title: t.campaigns ?? t.navCampaigns },
    { page: 'inbox', label: t.navInbox, short: 'I', title: t.inbox },
    { page: 'analytics', label: t.navAnalytics, short: 'A', title: t.analytics },
    { page: 'promptRegistry', label: t.navPromptRegistry, short: 'PR', title: t.promptRegistry },
  ];
  const parallelSurfaceLinks = [
    { href: '?view=builder-v2', label: 'Builder V2', short: 'B2', title: 'Open Builder V2' },
    { href: '?view=inbox-v2', label: 'Inbox V2', short: 'I2', title: 'Open Inbox V2' },
  ] as const;

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const result = await fetchServices();
        if (!cancelled) setServices(result.services);
      } catch {
        if (!cancelled) {
          setServices([
            { name: 'Supabase', category: 'database', status: 'disconnected', hasApiKey: false },
            { name: 'Smartlead', category: 'delivery', status: 'disconnected', hasApiKey: false },
          ]);
        }
      }
    };
    load().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  const isEnrichmentProviderReady = (providerId: string) => {
    return isEnrichmentProviderReadyForServices(providerId, enrichmentProviderOptions, services);
  };

  const setEnrichmentSettings = (next: any) => {
    setEnrichmentSettingsState(next);
    if (!selectedEnrichmentProviders.length && next?.defaultProviders?.length) {
      setSelectedEnrichmentProviders(next.defaultProviders);
    }
  };

  const persistEnrichmentSettings = async (next: any) => {
    setEnrichmentSettingsBusy(true);
    setEnrichmentSettingsError(null);
    try {
      const saved = await saveEnrichmentSettings({
        defaultProviders: next.defaultProviders,
        primaryCompanyProvider: next.primaryCompanyProvider,
        primaryEmployeeProvider: next.primaryEmployeeProvider,
      });
      setEnrichmentSettings(saved);
    } catch (err: any) {
      setEnrichmentSettingsError(err?.message ?? 'Failed to save enrichment settings');
    } finally {
      setEnrichmentSettingsBusy(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await fetchEnrichmentSettings();
        if (cancelled) return;
        const normalized = normalizeEnrichmentSettings(settings as any, isEnrichmentProviderReady);
        setEnrichmentSettings(normalized);
        setSelectedEnrichmentProviders(normalized.defaultProviders);
      } catch (err: any) {
        if (!cancelled) {
          const fallback = buildFallbackEnrichmentSettings();
          setEnrichmentSettings(fallback);
          setSelectedEnrichmentProviders(fallback.defaultProviders);
        }
      }
    };
    load().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [services]);

  useEffect(() => {
    let cancelled = false;
    const loadSegments = async () => {
      try {
        const rows = await fetchSegments();
        if (!cancelled) setSegments(rows as any[]);
      } catch {
        if (!cancelled) setSegments([]);
      }
    };
    loadSegments().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadProfiles = async () => {
      try {
        const rows = await fetchIcpProfiles();
        if (!cancelled) {
          setIcpProfiles(rows as any[]);
        }
      } catch {
        if (!cancelled) setIcpProfiles([]);
      }
    };
    loadProfiles().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const icpId = completed.icp?.id;
    if (!icpId) {
      setHypotheses([]);
      return;
    }
    let cancelled = false;
    const loadHypotheses = async () => {
      try {
        const rows = await fetchIcpHypotheses({ icpProfileId: icpId });
        if (!cancelled) setHypotheses(rows as any[]);
      } catch {
        if (!cancelled) setHypotheses([]);
      }
    };
    loadHypotheses().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [completed.icp?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadCampaigns = async () => {
      try {
        const rows = await fetchCampaigns();
        if (cancelled) return;
        setCampaigns(rows as any[]);
        if (!selectedCampaignId && (rows as any[])[0]) {
          setSelectedCampaignId((rows as any[])[0].id as string);
        }
      } catch {
        if (!cancelled) setCampaigns([]);
      }
    };
    loadCampaigns().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!smartleadReady) return;
    let cancelled = false;
    const loadSmartlead = async () => {
      try {
        const rows = await fetchSmartleadCampaigns();
        if (cancelled) return;
        setSmartleadCampaigns(rows as any[]);
        if (!selectedSmartleadCampaignId && (rows as any[])[0]) {
          setSelectedSmartleadCampaignId((rows as any[])[0].id as string);
        }
      } catch {
        if (!cancelled) setSmartleadCampaigns([]);
      }
    };
    loadSmartlead().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [selectedSmartleadCampaignId, smartleadReady]);

  const handleCreateCampaign = async () => {
    const name = newCampaignName.trim();
    if (!name) {
      setCampaignCreateError('Campaign name is required');
      return;
    }
    if (!completed.segment?.id) {
      setCampaignCreateError('Select a segment first');
      return;
    }
    setCampaignCreateBusy(true);
    setCampaignCreateError(null);
    try {
      const snapshot = await snapshotSegment({ segmentId: completed.segment.id, finalize: true });
      const segmentVersion =
        typeof snapshot?.version === 'number'
          ? snapshot.version
          : typeof completed.segment?.version === 'number'
          ? completed.segment.version
          : 1;
      const created = await createCampaign({
        name,
        segmentId: completed.segment.id,
        segmentVersion,
      });
      setCampaigns((prev) => [created, ...prev]);
      setSelectedCampaignId(created.id);
      setNewCampaignName('');
    } catch (err: any) {
      setCampaignCreateError(err?.message ?? 'Failed to create campaign');
    } finally {
      setCampaignCreateBusy(false);
    }
  };

  useEffect(() => {
    if (currentPage !== 'promptRegistry') return;
    let cancelled = false;
    const loadPrompts = async () => {
      setPromptLoading(true);
      setPromptError(null);
      try {
        const rows = await fetchPromptRegistry();
        if (!cancelled) setPromptEntries(rows as any[]);
      } catch (err: any) {
        if (!cancelled) setPromptError(err?.message ?? 'Failed to load prompts');
      } finally {
        if (!cancelled) setPromptLoading(false);
      }
    };
    loadPrompts().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  useEffect(() => {
    if (currentPage !== 'inbox') return;
    let cancelled = false;
    const loadInbox = async () => {
      setInboxLoading(true);
      setInboxError(null);
      try {
        const status =
          inboxFilter === 'unread' ? 'unread' : inboxFilter === 'starred' ? 'starred' : undefined;
        const res = await fetchInboxMessages({ status, limit: 50 });
        if (!cancelled) {
          setInboxMessages(res.messages as any[]);
        }
      } catch (err: any) {
        if (!cancelled) {
          setInboxError(err?.message ?? 'Failed to load inbox');
          setInboxMessages([]);
        }
      } finally {
        if (!cancelled) setInboxLoading(false);
      }
    };
    loadInbox().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [currentPage, inboxFilter]);

  useEffect(() => {
    if (currentPage !== 'analytics') return;
    let cancelled = false;
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      try {
        const [summary, optimize] = await Promise.all([
          fetchAnalyticsSummary({ groupBy: analyticsGroupBy, since: undefined }),
          fetchAnalyticsOptimize({ since: undefined }),
        ]);
        if (cancelled) return;
        setAnalyticsRows(summary as any[]);
        setAnalyticsSuggestions(((optimize as any)?.suggestions ?? []) as any[]);
      } catch (err: any) {
        if (cancelled) return;
        setAnalyticsError(err?.message ?? 'Failed to load analytics');
        setAnalyticsRows([]);
        setAnalyticsSuggestions([]);
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    };
    loadAnalytics().catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [currentPage, analyticsGroupBy]);

  useEffect(() => {
    setAiTranscript([]);
    setAiMessage('');
    setAiError(null);
  }, [currentStep]);

  const languages = [
    { code: 'en', label: 'EN', name: 'English' },
    { code: 'es', label: 'ES', name: 'Español' },
    { code: 'fr', label: 'FR', name: 'Français' },
    { code: 'de', label: 'DE', name: 'Deutsch' },
    { code: 'ru', label: 'RU', name: 'Русский' },
  ];

  const colors = getWorkspaceColors(isDark);

  const icpSummary = completed.icp ? buildIcpSummaryFromProfile(completed.icp) : null;
  const hypothesisSummary = completed.hypothesis
    ? buildHypothesisSummaryFromSearchConfig(completed.hypothesis)
    : null;

  const handleSelectExisting = (type, item) => {
    setCompleted((prev) => ({
      ...prev,
      [type]: item,
    }));

    const selectedIndex = pipeline.findIndex((s) => s.id === type);
    if (selectedIndex === -1) return;

    const currentIndex = pipeline.findIndex((s) => s.id === currentStep);

    // If user clicks a previous step (e.g., from Segment back to Hypothesis or ICP),
    // move focus back to that step instead of auto-advancing.
    if (currentIndex > selectedIndex) {
      setCurrentStep(type);
      return;
    }

    // For the current step, keep the auto-advance behaviour to the next unlocked step.
    if (selectedIndex < pipeline.length - 1) {
      const nextStep = pipeline[selectedIndex + 1];
      if (!nextStep.locked || type === currentStep) {
        setCurrentStep(nextStep.id);
      }
    }
  };

  const handleAiSend = async () => {
    const trimmed = aiMessage.trim();
    if (!trimmed) {
      setAiError('Please describe what you want to generate.');
      return;
    }
    setAiTranscript((prev) =>
      appendInteractiveCoachMessage(prev, {
        role: 'user',
        text: trimmed,
        step: currentStep,
        entityId:
          currentStep === 'icp'
            ? completed.icp?.id ?? null
            : currentStep === 'hypothesis'
            ? completed.hypothesis?.id ?? null
            : null,
      })
    );
    setAiLoading(true);
    setAiError(null);
    try {
      if (currentStep === 'icp') {
        const runMode = resolveCoachRunMode('icp', completed as any);
        const promptId = taskPrompts.icpDiscovery || undefined;
        const latestSettings = loadSettings();
        const modelCfg = latestSettings.providers.icp;
        const currentSummary = completed.icp ? buildIcpSummaryFromProfile(completed.icp) : null;
        const summaryForPrompt = runMode === 'refine' ? currentSummary : null;
        const userPrompt = buildInteractiveIcpPrompt(summaryForPrompt, trimmed);
        const profile = await generateIcpProfileViaCoach({
          name: trimmed,
          userPrompt,
          promptId,
          provider: modelCfg.provider,
          model: modelCfg.model,
        });
        setIcpProfiles((prev) => {
          const next = applyCoachResultToState(
            runMode,
            'icp',
            profile,
            prev,
            hypotheses,
            completed as any
          );
          return next.profiles;
        });
        handleSelectExisting('icp', profile);
        const summary = buildIcpSummaryFromProfile(profile);
        const summaryText = formatIcpSummaryForChat(summary);
        if (summaryText) {
          setAiTranscript((prev) =>
            appendInteractiveCoachMessage(prev, {
              role: 'assistant',
              text: summaryText,
              step: 'icp',
              entityId: profile.id,
            })
          );
        }
      } else if (currentStep === 'hypothesis') {
        if (!completed.icp?.id) {
          setAiError('Select an ICP profile first.');
          return;
        }
        const runMode = resolveCoachRunMode('hypothesis', completed as any);
        const promptId = taskPrompts.hypothesisGen || undefined;
        const latestSettings = loadSettings();
        const modelCfg = latestSettings.providers.hypothesis;
        const currentSummary = completed.hypothesis
          ? buildHypothesisSummaryFromSearchConfig(completed.hypothesis)
          : null;
        const summaryForPrompt = runMode === 'refine' ? currentSummary : null;
        const userPrompt = buildInteractiveHypothesisPrompt(summaryForPrompt, trimmed);
        const hyp = await generateHypothesisViaCoach({
          icpProfileId: completed.icp.id,
          hypothesisLabel: trimmed,
          userPrompt,
          provider: modelCfg.provider,
          model: modelCfg.model,
          promptId,
        });
        setHypotheses((prev) => {
          const next = applyCoachResultToState(
            runMode,
            'hypothesis',
            hyp,
            icpProfiles,
            prev,
            completed as any
          );
          return next.hypotheses;
        });
        handleSelectExisting('hypothesis', hyp);
        const summary = buildHypothesisSummaryFromSearchConfig(hyp);
        const summaryText = formatHypothesisSummaryForChat(summary);
        if (summaryText) {
          setAiTranscript((prev) =>
            appendInteractiveCoachMessage(prev, {
              role: 'assistant',
              text: summaryText,
              step: 'hypothesis',
              entityId: hyp.id,
            })
          );
        }
      }
      setAiMessage('');
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to generate via AI coach');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateIcpQuick = async () => {
    const name = newIcpName.trim();
    if (!name) {
      setAiError('ICP name is required.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const created = await createIcpProfile({
        name,
        description: newIcpDescription.trim() || undefined,
      });
      setIcpProfiles((prev) => [created as any, ...prev]);
      handleSelectExisting('icp', created);
      setNewIcpName('');
      setNewIcpDescription('');
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to create ICP profile');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreateHypothesisQuick = async () => {
    const label = newHypothesisLabel.trim();
    if (!completed.icp?.id) {
      setAiError('Select an ICP profile first.');
      return;
    }
    if (!label) {
      setAiError('Hypothesis label is required.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const created = await createIcpHypothesis({
        icpProfileId: completed.icp.id,
        hypothesisLabel: label,
      });
      setHypotheses((prev) => [created as any, ...prev]);
      handleSelectExisting('hypothesis', created);
      setNewHypothesisLabel('');
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to create hypothesis');
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunDiscovery = async () => {
    if (!completed.icp?.id) {
      setAiError('Select an ICP profile before running discovery.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    setDiscoveryStatus(null);
    try {
      const result = await triggerIcpDiscovery({
        icpProfileId: completed.icp.id,
        icpHypothesisId: completed.hypothesis?.id,
      });
      persistLatestDiscoveryRun({
        runId: result.runId,
        icpProfileId: completed.icp.id,
        icpHypothesisId: completed.hypothesis?.id ?? null,
      });
      setDiscoveryStatus(
        `Discovery run ${result.runId} started (${result.provider}). Status: ${result.status}`
      );
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to start ICP discovery');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearchDatabaseClick = () => {
    setShowSegmentBuilder(true);
  };

  const handleCreateSegment = async (segment: {name: string; filterDefinition: any[]}) => {
    try {
      const updatedSegments = await createSegmentAndRefresh(segment, {
        createSegmentApi: createSegmentAPI,
        fetchSegmentsApi: fetchSegments,
      });
      setShowSegmentBuilder(false);
      setSegments(updatedSegments);
      console.log('Segment created successfully:', segment.name);
    } catch (error) {
      console.error('Failed to create segment:', error);
    }
  };

  const handleSaveExaSegment = async (segment: {
    name: string;
    companies: any[];
    employees: any[];
    query: string;
  }) => {
    try {
      const updatedSegments = await saveExaSegmentAndRefresh(segment, language, {
        saveExaSegmentApi: saveExaSegmentAPI,
        fetchSegmentsApi: fetchSegments,
      });
      setShowExaWebsetSearch(false);
      setSegments(updatedSegments);
      console.log('EXA segment saved successfully:', segment.name);
    } catch (error) {
      console.error('Failed to save EXA segment:', error);
    }
  };

  const handleEnrichSegment = async () => {
    if (!completed.segment?.id) {
      setAiError('Select a segment before enrichment.');
      return;
    }
    setEnrichLoading(true);
    setAiError(null);
    setEnrichResults(null);
    try {
      const result = await runEnrichmentJob(
        {
          segmentId: completed.segment.id,
          selectedProviders: selectedEnrichmentProviders,
          defaultProviders: enrichmentSettings?.defaultProviders,
        },
        {
          enqueueSingle: enqueueSegmentEnrichment,
          enqueueMulti: enqueueSegmentEnrichmentMulti,
        }
      );
      setEnrichResults(result.results);
      setEnrichStatus(result.status);
    } catch (err: any) {
      setAiError(mapEnrichmentErrorMessage(err));
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleGenerateDrafts = async () => {
    if (!selectedCampaignId) {
      setAiError('Select a campaign before generating drafts.');
      return;
    }
    setDraftLoading(true);
    setAiError(null);
    try {
      const settings = loadSettings();
      const draftModel = settings.providers.draft;
      const explicitPromptId = taskPrompts.emailDraft || undefined;
      const result = await generateDraftsForCampaign(
        {
          campaignId: selectedCampaignId,
          dryRun: draftDryRun,
          limit: draftLimit,
          dataQualityMode,
          interactionMode,
          icpProfileId: completed.icp?.id ?? undefined,
          icpHypothesisId: completed.hypothesis?.id ?? undefined,
          provider: draftModel.provider,
          model: draftModel.model,
          explicitCoachPromptId: explicitPromptId,
        },
        {
          triggerDraftGenerate,
        }
      );
      setDraftSummary(result.summary);
      if (result.error) {
        setAiError(result.error);
        return;
      }
      if (result.completedDraft) {
        setCompleted((prev) => ({
          ...prev,
          draft: result.completedDraft,
        }));
      }
      if (result.nextStep) {
        setCurrentStep(result.nextStep);
      }
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to generate drafts');
    } finally {
      setDraftLoading(false);
    }
  };

  const handlePrepareSmartlead = async () => {
    if (!smartleadReady) {
      setAiError('Smartlead environment is not configured.');
      return;
    }
    if (!selectedCampaignId) {
      setAiError('Select a campaign before preparing Smartlead.');
      return;
    }
    if (!selectedSmartleadCampaignId) {
      setAiError('Select a Smartlead campaign before preparing.');
      return;
    }
    setSendLoading(true);
    setAiError(null);
    try {
      setSendSummary(
        await prepareSmartleadCampaignSync(
          {
            dryRun: sendDryRun,
            batchSize: sendBatchSize,
            campaignId: selectedCampaignId,
            smartleadCampaignId: selectedSmartleadCampaignId,
          },
          {
            triggerSmartlead: triggerSmartleadSend,
          }
        )
      );
    } catch (err: any) {
      setAiError(err?.message ?? 'Failed to prepare Smartlead');
    } finally {
      setSendLoading(false);
    }
  };

  // Render main content based on current page
  const renderPageContent = () => {
    if (currentPage === 'campaigns') {
      return <CampaignOperatorDesk isDark={isDark} language={language} />;
    }

    if (currentPage === 'inbox') {
      return (
        <LegacyInboxPage
          colors={colors}
          filter={inboxFilter}
          messages={inboxMessages}
          loading={inboxLoading}
          error={inboxError}
          copy={t.inboxPage}
          onFilterChange={setInboxFilter}
        />
      );
    }

    if (currentPage === 'analytics') {
      return (
        <LegacyAnalyticsPage
          colors={colors}
          copy={t.analyticsPage}
          error={analyticsError}
          groupBy={analyticsGroupBy}
          loading={analyticsLoading}
          rows={analyticsRows}
          suggestions={analyticsSuggestions}
          onGroupByChange={setAnalyticsGroupBy}
        />
      );
    }

    if (currentPage === 'promptRegistry') {
      return (
        <LegacyPromptRegistryPage
          colors={colors}
          copy={t.promptRegistryPage}
          entries={promptEntries}
          filterStatus={promptFilterStatus}
          llmModels={llmModels}
          llmModelsError={llmModelsError}
          promptCreateForm={promptCreateForm}
          promptError={promptError}
          promptLoading={promptLoading}
          settings={settings}
          showPromptCreate={showPromptCreate}
          taskLabels={t.settingsModal.tasks}
          taskPrompts={taskPrompts}
          onCreateToggle={() => setShowPromptCreate(!showPromptCreate)}
          onDismissCreate={() => setShowPromptCreate(false)}
          onFieldChange={(field, value) => {
            setPromptCreateForm((prev) => ({ ...prev, [field]: value }));
          }}
          onFilterChange={setPromptFilterStatus}
          onModelChange={(task, model) => {
            const providerKey = mapTaskToProviderKey(task);
            const next: Settings = {
              ...settings,
              providers: {
                ...settings.providers,
                [providerKey]: {
                  ...settings.providers[providerKey],
                  model,
                },
              },
            };
            setSettings(next);
            saveSettings(next);
          }}
          onPromptChange={(task, promptId) => {
            setTaskPrompts((prev) => {
              const next = setTaskPrompt(prev, task, promptId);
              try {
                const currentSettings = loadSettings();
                saveSettings({
                  ...currentSettings,
                  taskPrompts: next,
                });
              } catch {
                // Swallow persistence errors; UI state still updates.
              }
              return next;
            });
          }}
          onProviderChange={(task, provider, nextModel) => {
            const providerKey = mapTaskToProviderKey(task);
            const next: Settings = {
              ...settings,
              providers: {
                ...settings.providers,
                [providerKey]: {
                  provider,
                  model: nextModel,
                },
              },
            };
            setSettings(next);
            saveSettings(next);
          }}
          onSave={async () => {
            try {
              setPromptLoading(true);
              setPromptError(null);
              const payload = buildPromptCreateEntry(promptCreateForm);
              await createPromptRegistryEntry(payload);
              const rows = await fetchPromptRegistry();
              setPromptEntries(rows);
              setPromptCreateForm((prev) => ({
                ...prev,
                description: '',
                prompt_text: '',
              }));
              setShowPromptCreate(false);
            } catch (err: any) {
              setPromptError(err?.message ?? 'Failed to create prompt');
            } finally {
              setPromptLoading(false);
            }
          }}
          onSetActive={async (entry) => {
            try {
              setPromptLoading(true);
              setPromptError(null);
              const rows = await applyActivePromptSelection(entry.step, entry.id, {
                setActivePromptApi: setActivePrompt,
                fetchPromptRegistryApi: fetchPromptRegistry,
              });
              if (rows) setPromptEntries(rows);
            } catch (err: any) {
              setPromptError(err?.message ?? 'Failed to set active prompt');
            } finally {
              setPromptLoading(false);
            }
          }}
        />
      );
    }

    return (
      <LegacyPipelineShell
        colors={colors}
        completed={completed}
        currentConfigLabel={t.currentConfig}
        currentStep={currentStep}
        hypothesisSummary={hypothesisSummary}
        icpSummary={icpSummary}
        notSelectedLabel={t.notSelected}
        pipeline={pipeline}
        stepLabels={{
          icp: t.steps.icp.label,
          hypothesis: t.steps.hypothesis.label,
          segment: t.steps.segment.label,
        }}
        onStepSelect={setCurrentStep}
      >
        <LegacyPipelineStepRouter
          aiLoading={aiLoading}
          campaignCreateBusy={campaignCreateBusy}
          campaignCreateError={campaignCreateError}
          campaigns={campaigns}
          colors={colors}
          completed={completed}
          copy={t}
          currentStep={currentStep}
          dataQualityMode={dataQualityMode}
          discoveryStatus={discoveryStatus}
          draftDryRun={draftDryRun}
          draftLimit={draftLimit}
          draftLoading={draftLoading}
          draftSummary={draftSummary}
          enrichLoading={enrichLoading}
          enrichResults={enrichResults}
          enrichStatus={enrichStatus}
          enrichmentDefaults={enrichmentSettings?.defaultProviders ?? []}
          enrichmentPrimarySummary={{
            company: enrichmentSettings?.primaryCompanyProvider ?? null,
            lead: enrichmentSettings?.primaryEmployeeProvider ?? null,
          }}
          hasPersistedDiscoveryRun={hasPersistedDiscoveryRun()}
          hypotheses={hypotheses}
          icpProfiles={icpProfiles}
          interactionMode={interactionMode}
          isProviderReady={isEnrichmentProviderReady}
          newCampaignName={newCampaignName}
          newHypothesisLabel={newHypothesisLabel}
          newIcpDescription={newIcpDescription}
          newIcpName={newIcpName}
          providerOptions={enrichmentProviderOptions}
          segments={segments}
          selectedCampaignId={selectedCampaignId}
          selectedProviders={selectedEnrichmentProviders}
          selectedSmartleadCampaignId={selectedSmartleadCampaignId}
          sendBatchSize={sendBatchSize}
          sendDryRun={sendDryRun}
          sendLoading={sendLoading}
          sendSummary={sendSummary}
          smartleadCampaigns={smartleadCampaigns}
          smartleadReady={smartleadReady}
          onBatchSizeChange={setSendBatchSize}
          onCampaignChange={setSelectedCampaignId}
          onCreateCampaign={() => handleCreateCampaign().catch(() => null)}
          onCreateHypothesisQuick={() => handleCreateHypothesisQuick().catch(() => null)}
          onCreateIcpQuick={() => handleCreateIcpQuick().catch(() => null)}
          onDataQualityModeChange={setDataQualityMode}
          onDraftDryRunChange={setDraftDryRun}
          onDraftLimitChange={setDraftLimit}
          onEnrich={() => handleEnrichSegment().catch(() => null)}
          onGenerateDrafts={() => handleGenerateDrafts().catch(() => null)}
          onHypothesisLabelChange={setNewHypothesisLabel}
          onIcpDescriptionChange={setNewIcpDescription}
          onIcpNameChange={setNewIcpName}
          onInteractionModeChange={setInteractionMode}
          onNewCampaignNameChange={setNewCampaignName}
          onOpenAiChat={() => setShowAIChat(true)}
          onOpenDiscovery={openIcpDiscoveryForLatestRun}
          onOpenExaSearch={() => setShowExaWebsetSearch(true)}
          onOpenSegmentBuilder={handleSearchDatabaseClick}
          onPrepareSend={() => handlePrepareSmartlead().catch(() => null)}
          onProviderToggle={(providerId) => {
            if (!isEnrichmentProviderReady(providerId)) return;
            setSelectedEnrichmentProviders((prev) =>
              toggleEnrichmentProviderSelection(prev, providerId)
            );
          }}
          onResetProviders={() =>
            setSelectedEnrichmentProviders(enrichmentSettings?.defaultProviders ?? ['mock'])
          }
          onSelectHypothesis={(hypothesis) => handleSelectExisting('hypothesis', hypothesis)}
          onSelectIcp={(profile) => handleSelectExisting('icp', profile)}
          onSelectSegment={(segment) => handleSelectExisting('segment', segment)}
          onSendDryRunChange={setSendDryRun}
          onSkipEnrichment={() => setCurrentStep('draft')}
          onSmartleadCampaignChange={setSelectedSmartleadCampaignId}
        />
      </LegacyPipelineShell>
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
      <LegacyWorkspaceSidebar
        colors={colors}
        currentPage={currentPage}
        navItems={navItems}
        parallelSurfaceLinks={parallelSurfaceLinks}
        settingsLabel={t.settings}
        servicesLabel={t.services}
        collapseLabel={t.collapseNav}
        sidebarExpanded={sidebarExpanded}
        onNavigate={setCurrentPage}
        onToggleSidebar={() => setSidebarExpanded(!sidebarExpanded)}
        onShowSettings={() => setShowSettings(true)}
        onShowServices={() => setShowServices(true)}
      />

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <LegacyWorkspaceTopbar
          apiBase={apiBase}
          colors={colors}
          heroSubtitle={t.hero.subtitle}
          heroTitleAccent={t.hero.title2}
          heroTitlePrefix={t.hero.title1}
          heroTitleSuffix={t.hero.title3}
          isDark={isDark}
          language={language}
          languages={languages}
          modeLabel={modeLabel}
          parallelSurfaceLinks={parallelSurfaceLinks}
          services={services}
          showLanguageMenu={showLanguageMenu}
          smartleadReady={smartleadReady}
          supabaseReady={supabaseReady}
          onSelectLanguage={(code) => {
            setLanguage(code);
            setShowLanguageMenu(false);
          }}
          onToggleDarkMode={() => setIsDark(!isDark)}
          onToggleLanguageMenu={() => setShowLanguageMenu(!showLanguageMenu)}
        />

        {/* Page Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {renderPageContent()}
        </div>
      </div>

      {/* AI Chat Modal */}
      {showAIChat && (
        <LegacyAiChatModal
          aiError={aiError}
          aiLoading={aiLoading}
          aiMessage={aiMessage}
          aiTranscript={aiTranscript}
          colors={colors}
          copy={t.aiChat}
          currentStep={currentStep}
          onClose={() => {
            setShowAIChat(false);
            setAiTranscript([]);
            setAiMessage('');
            setAiError(null);
          }}
          onMessageChange={setAiMessage}
          onSend={() => handleAiSend().catch(() => null)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <LegacyWorkspaceSettingsModal
          colors={colors}
          enrichmentProviderOptions={enrichmentProviderOptions}
          enrichmentSettings={enrichmentSettings}
          enrichmentSettingsBusy={enrichmentSettingsBusy}
          enrichmentSettingsError={enrichmentSettingsError}
          isDark={isDark}
          services={services}
          servicesCopy={t.servicesModal}
          title={t.settingsModal.title}
          onClose={() => setShowSettings(false)}
          onPersistEnrichmentSettings={persistEnrichmentSettings}
          isEnrichmentProviderReady={isEnrichmentProviderReady}
        />
      )}

      {/* Services Modal */}
      {showServices && (
        <LegacyWorkspaceServicesModal
          colors={colors}
          services={services}
          servicesCopy={t.servicesModal}
          title={t.servicesModal.title}
          onClose={() => setShowServices(false)}
        />
      )}

      <SegmentBuilder
        isOpen={showSegmentBuilder}
        onClose={() => setShowSegmentBuilder(false)}
        onCreate={handleCreateSegment}
        colors={colors}
      />

      <ExaWebsetSearch
        isOpen={showExaWebsetSearch}
        onClose={() => setShowExaWebsetSearch(false)}
        onSave={handleSaveExaSegment}
        colors={colors}
      />
    </div>
  );
}
