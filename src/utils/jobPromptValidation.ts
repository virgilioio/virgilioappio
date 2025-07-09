// Job prompt validation with expanded multi-language keyword detection
// Optimized for performance with compiled regex patterns

interface KeywordDictionary {
  en: string[]
  es: string[]
  pt: string[]
  fr: string[]
}

// Comprehensive keyword dictionaries for each validation category
const ROLE_KEYWORDS: KeywordDictionary = {
  en: [
    // Technical roles
    'engineer', 'developer', 'programmer', 'architect', 'analyst', 'scientist', 'specialist', 'technician', 'admin', 'administrator',
    'frontend', 'backend', 'fullstack', 'devops', 'sre', 'qa', 'tester', 'designer', 'ux', 'ui', 'product',
    // Management roles
    'manager', 'director', 'lead', 'head', 'chief', 'cto', 'ceo', 'cfo', 'vp', 'president', 'supervisor', 'coordinator',
    // Sales & Marketing
    'sales', 'marketing', 'account', 'business', 'consultant', 'representative', 'rep', 'associate', 'executive',
    // Support & Operations
    'support', 'customer', 'operations', 'intern', 'trainee', 'junior', 'senior', 'principal', 'staff',
    // Industry specific
    'nurse', 'doctor', 'teacher', 'professor', 'lawyer', 'accountant', 'recruiter', 'hr', 'finance', 'legal'
  ],
  es: [
    // Roles técnicos
    'ingeniero', 'desarrollador', 'programador', 'arquitecto', 'analista', 'científico', 'especialista', 'técnico', 'administrador',
    'frontend', 'backend', 'fullstack', 'devops', 'qa', 'probador', 'diseñador', 'ux', 'ui', 'producto',
    // Roles de gestión
    'gerente', 'director', 'líder', 'jefe', 'presidente', 'cto', 'ceo', 'cfo', 'vp', 'supervisor', 'coordinador',
    // Ventas y Marketing
    'ventas', 'marketing', 'mercadeo', 'cuenta', 'negocio', 'consultor', 'representante', 'asociado', 'ejecutivo',
    // Soporte y Operaciones
    'soporte', 'cliente', 'operaciones', 'practicante', 'trainee', 'júnior', 'sénior', 'principal', 'staff',
    // Específicos de industria
    'enfermero', 'médico', 'maestro', 'profesor', 'abogado', 'contador', 'reclutador', 'rrhh', 'finanzas', 'legal'
  ],
  pt: [
    // Roles técnicos
    'engenheiro', 'desenvolvedor', 'programador', 'arquiteto', 'analista', 'cientista', 'especialista', 'técnico', 'administrador',
    'frontend', 'backend', 'fullstack', 'devops', 'qa', 'testador', 'designer', 'ux', 'ui', 'produto',
    // Roles de gestão
    'gerente', 'diretor', 'líder', 'chefe', 'presidente', 'cto', 'ceo', 'cfo', 'vp', 'supervisor', 'coordenador',
    // Vendas e Marketing
    'vendas', 'marketing', 'conta', 'negócio', 'consultor', 'representante', 'associado', 'executivo',
    // Suporte e Operações
    'suporte', 'cliente', 'operações', 'estagiário', 'trainee', 'júnior', 'sênior', 'principal', 'staff',
    // Específicos da indústria
    'enfermeiro', 'médico', 'professor', 'advogado', 'contador', 'recrutador', 'rh', 'finanças', 'jurídico'
  ],
  fr: [
    // Rôles techniques
    'ingénieur', 'développeur', 'programmeur', 'architecte', 'analyste', 'scientifique', 'spécialiste', 'technicien', 'administrateur',
    'frontend', 'backend', 'fullstack', 'devops', 'qa', 'testeur', 'concepteur', 'ux', 'ui', 'produit',
    // Rôles de gestion
    'gestionnaire', 'directeur', 'dirigeant', 'chef', 'président', 'cto', 'ceo', 'cfo', 'vp', 'superviseur', 'coordinateur',
    // Ventes et Marketing
    'ventes', 'marketing', 'compte', 'business', 'consultant', 'représentant', 'associé', 'exécutif',
    // Support et Opérations
    'support', 'client', 'opérations', 'stagiaire', 'trainee', 'junior', 'senior', 'principal', 'staff',
    // Spécifiques à l\'industrie
    'infirmier', 'médecin', 'professeur', 'avocat', 'comptable', 'recruteur', 'rh', 'finances', 'juridique'
  ]
}

const RESPONSIBILITY_KEYWORDS: KeywordDictionary = {
  en: [
    // Development & Creation
    'build', 'develop', 'create', 'design', 'implement', 'code', 'program', 'architect', 'engineer', 'construct',
    'deploy', 'launch', 'release', 'ship', 'deliver', 'integrate', 'configure', 'setup', 'install',
    // Management & Leadership
    'manage', 'lead', 'oversee', 'supervise', 'coordinate', 'organize', 'plan', 'strategize', 'direct', 'guide',
    'mentor', 'coach', 'train', 'teach', 'onboard', 'hire', 'recruit', 'staff',
    // Analysis & Research
    'analyze', 'research', 'investigate', 'study', 'evaluate', 'assess', 'review', 'audit', 'test', 'validate',
    'monitor', 'track', 'measure', 'report', 'document', 'record',
    // Optimization & Improvement
    'optimize', 'improve', 'enhance', 'streamline', 'automate', 'scale', 'grow', 'expand', 'increase', 'boost',
    'reduce', 'minimize', 'eliminate', 'fix', 'resolve', 'troubleshoot', 'debug',
    // Communication & Collaboration
    'communicate', 'collaborate', 'coordinate', 'present', 'facilitate', 'negotiate', 'discuss', 'meet',
    'support', 'assist', 'help', 'serve', 'maintain', 'update', 'upgrade'
  ],
  es: [
    // Desarrollo y Creación
    'construir', 'desarrollar', 'crear', 'diseñar', 'implementar', 'codificar', 'programar', 'arquitecturar', 'ingeniería', 'construir',
    'desplegar', 'lanzar', 'liberar', 'entregar', 'integrar', 'configurar', 'configuración', 'instalar',
    // Gestión y Liderazgo
    'gestionar', 'liderar', 'supervisar', 'coordinar', 'organizar', 'planificar', 'estrategia', 'dirigir', 'guiar',
    'mentorear', 'entrenar', 'enseñar', 'incorporar', 'contratar', 'reclutar', 'personal',
    // Análisis e Investigación
    'analizar', 'investigar', 'estudiar', 'evaluar', 'valorar', 'revisar', 'auditar', 'probar', 'validar',
    'monitorear', 'rastrear', 'medir', 'reportar', 'documentar', 'registrar',
    // Optimización y Mejora
    'optimizar', 'mejorar', 'potenciar', 'agilizar', 'automatizar', 'escalar', 'crecer', 'expandir', 'aumentar', 'impulsar',
    'reducir', 'minimizar', 'eliminar', 'arreglar', 'resolver', 'solucionar', 'depurar',
    // Comunicación y Colaboración
    'comunicar', 'colaborar', 'coordinar', 'presentar', 'facilitar', 'negociar', 'discutir', 'reunir',
    'apoyar', 'asistir', 'ayudar', 'servir', 'mantener', 'actualizar', 'mejorar'
  ],
  pt: [
    // Desenvolvimento e Criação
    'construir', 'desenvolver', 'criar', 'projetar', 'implementar', 'codificar', 'programar', 'arquitetar', 'engenharia', 'construir',
    'implantar', 'lançar', 'liberar', 'entregar', 'integrar', 'configurar', 'configuração', 'instalar',
    // Gestão e Liderança
    'gerenciar', 'liderar', 'supervisionar', 'coordenar', 'organizar', 'planejar', 'estratégia', 'dirigir', 'guiar',
    'mentorar', 'treinar', 'ensinar', 'integrar', 'contratar', 'recrutar', 'pessoal',
    // Análise e Pesquisa
    'analisar', 'pesquisar', 'investigar', 'estudar', 'avaliar', 'revisar', 'auditar', 'testar', 'validar',
    'monitorar', 'rastrear', 'medir', 'relatar', 'documentar', 'registrar',
    // Otimização e Melhoria
    'otimizar', 'melhorar', 'aprimorar', 'agilizar', 'automatizar', 'escalar', 'crescer', 'expandir', 'aumentar', 'impulsionar',
    'reduzir', 'minimizar', 'eliminar', 'corrigir', 'resolver', 'solucionar', 'depurar',
    // Comunicação e Colaboração
    'comunicar', 'colaborar', 'coordenar', 'apresentar', 'facilitar', 'negociar', 'discutir', 'reunir',
    'apoiar', 'assistir', 'ajudar', 'servir', 'manter', 'atualizar', 'melhorar'
  ],
  fr: [
    // Développement et Création
    'construire', 'développer', 'créer', 'concevoir', 'mettre en œuvre', 'coder', 'programmer', 'architecturer', 'ingénierie', 'construire',
    'déployer', 'lancer', 'libérer', 'livrer', 'intégrer', 'configurer', 'configuration', 'installer',
    // Gestion et Leadership
    'gérer', 'diriger', 'superviser', 'coordonner', 'organiser', 'planifier', 'stratégie', 'diriger', 'guider',
    'mentorer', 'entraîner', 'enseigner', 'intégrer', 'embaucher', 'recruter', 'personnel',
    // Analyse et Recherche
    'analyser', 'rechercher', 'enquêter', 'étudier', 'évaluer', 'examiner', 'auditer', 'tester', 'valider',
    'surveiller', 'suivre', 'mesurer', 'rapporter', 'documenter', 'enregistrer',
    // Optimisation et Amélioration
    'optimiser', 'améliorer', 'améliorer', 'rationaliser', 'automatiser', 'mettre à l\'échelle', 'croître', 'étendre', 'augmenter', 'stimuler',
    'réduire', 'minimiser', 'éliminer', 'réparer', 'résoudre', 'dépanner', 'déboguer',
    // Communication et Collaboration
    'communiquer', 'collaborer', 'coordonner', 'présenter', 'faciliter', 'négocier', 'discuter', 'rencontrer',
    'soutenir', 'assister', 'aider', 'servir', 'maintenir', 'mettre à jour', 'améliorer'
  ]
}

const INDUSTRY_KEYWORDS: KeywordDictionary = {
  en: [
    // Technology
    'fintech', 'edtech', 'healthtech', 'proptech', 'adtech', 'martech', 'regtech', 'insurtech', 'biotech', 'cleantech',
    'startup', 'saas', 'paas', 'iaas', 'software', 'hardware', 'cloud', 'ai', 'ml', 'blockchain', 'crypto', 'web3',
    'ecommerce', 'marketplace', 'platform', 'app', 'mobile', 'web', 'api', 'microservices', 'devops', 'cybersecurity',
    // Traditional Industries
    'healthcare', 'finance', 'banking', 'insurance', 'retail', 'manufacturing', 'automotive', 'aerospace', 'energy',
    'education', 'government', 'nonprofit', 'consulting', 'legal', 'real estate', 'construction', 'agriculture',
    'entertainment', 'media', 'gaming', 'sports', 'hospitality', 'travel', 'logistics', 'supply chain', 'telecom',
    // Business Functions
    'marketing', 'sales', 'operations', 'product', 'engineering', 'design', 'hr', 'people', 'talent', 'recruiting',
    'finance', 'accounting', 'legal', 'compliance', 'security', 'it', 'support', 'customer success', 'business development'
  ],
  es: [
    // Tecnología
    'fintech', 'edtech', 'healthtech', 'proptech', 'adtech', 'martech', 'regtech', 'insurtech', 'biotech', 'cleantech',
    'startup', 'saas', 'paas', 'iaas', 'software', 'hardware', 'nube', 'ia', 'ml', 'blockchain', 'crypto', 'web3',
    'ecommerce', 'mercado', 'plataforma', 'app', 'móvil', 'web', 'api', 'microservicios', 'devops', 'ciberseguridad',
    // Industrias Tradicionales
    'sanitario', 'salud', 'finanzas', 'banca', 'seguros', 'retail', 'manufactura', 'automotriz', 'aeroespacial', 'energía',
    'educación', 'gobierno', 'sin ánimo de lucro', 'consultoría', 'legal', 'inmobiliario', 'construcción', 'agricultura',
    'entretenimiento', 'medios', 'gaming', 'deportes', 'hospitalidad', 'viajes', 'logística', 'cadena de suministro', 'telecom',
    // Funciones de Negocio
    'marketing', 'mercadeo', 'ventas', 'operaciones', 'producto', 'ingeniería', 'diseño', 'rrhh', 'personas', 'talento', 'reclutamiento',
    'finanzas', 'contabilidad', 'legal', 'cumplimiento', 'seguridad', 'it', 'soporte', 'éxito del cliente', 'desarrollo de negocio'
  ],
  pt: [
    // Tecnologia
    'fintech', 'edtech', 'healthtech', 'proptech', 'adtech', 'martech', 'regtech', 'insurtech', 'biotech', 'cleantech',
    'startup', 'saas', 'paas', 'iaas', 'software', 'hardware', 'nuvem', 'ia', 'ml', 'blockchain', 'crypto', 'web3',
    'ecommerce', 'marketplace', 'plataforma', 'app', 'móvel', 'web', 'api', 'microserviços', 'devops', 'cibersegurança',
    // Indústrias Tradicionais
    'saúde', 'finanças', 'banco', 'seguros', 'varejo', 'manufatura', 'automotivo', 'aeroespacial', 'energia',
    'educação', 'governo', 'sem fins lucrativos', 'consultoria', 'jurídico', 'imobiliário', 'construção', 'agricultura',
    'entretenimento', 'mídia', 'jogos', 'esportes', 'hospitalidade', 'viagem', 'logística', 'cadeia de suprimentos', 'telecom',
    // Funções de Negócio
    'marketing', 'vendas', 'operações', 'produto', 'engenharia', 'design', 'rh', 'pessoas', 'talento', 'recrutamento',
    'finanças', 'contabilidade', 'jurídico', 'conformidade', 'segurança', 'ti', 'suporte', 'sucesso do cliente', 'desenvolvimento de negócios'
  ],
  fr: [
    // Technologie
    'fintech', 'edtech', 'healthtech', 'proptech', 'adtech', 'martech', 'regtech', 'insurtech', 'biotech', 'cleantech',
    'startup', 'saas', 'paas', 'iaas', 'logiciel', 'matériel', 'nuage', 'ia', 'ml', 'blockchain', 'crypto', 'web3',
    'ecommerce', 'marketplace', 'plateforme', 'app', 'mobile', 'web', 'api', 'microservices', 'devops', 'cybersécurité',
    // Industries Traditionnelles
    'santé', 'finances', 'banque', 'assurance', 'retail', 'fabrication', 'automobile', 'aérospatial', 'énergie',
    'éducation', 'gouvernement', 'à but non lucratif', 'conseil', 'juridique', 'immobilier', 'construction', 'agriculture',
    'divertissement', 'médias', 'jeux', 'sports', 'hospitalité', 'voyage', 'logistique', 'chaîne d\'approvisionnement', 'télécom',
    // Fonctions Business
    'marketing', 'ventes', 'opérations', 'produit', 'ingénierie', 'design', 'rh', 'personnes', 'talent', 'recrutement',
    'finances', 'comptabilité', 'juridique', 'conformité', 'sécurité', 'it', 'support', 'succès client', 'développement commercial'
  ]
}

const LOCATION_KEYWORDS: KeywordDictionary = {
  en: [
    // Work arrangements
    'remote', 'hybrid', 'onsite', 'office', 'work from home', 'wfh', 'distributed', 'flexible', 'location independent',
    // Regions & Countries
    'usa', 'united states', 'america', 'canada', 'mexico', 'uk', 'united kingdom', 'europe', 'germany', 'france', 'spain',
    'italy', 'netherlands', 'brazil', 'argentina', 'colombia', 'chile', 'peru', 'asia', 'china', 'japan', 'india', 'singapore',
    'australia', 'new zealand', 'africa', 'south africa', 'israel', 'turkey', 'russia', 'poland', 'sweden', 'norway',
    // Cities
    'new york', 'los angeles', 'san francisco', 'chicago', 'boston', 'seattle', 'austin', 'miami', 'denver', 'atlanta',
    'london', 'paris', 'berlin', 'madrid', 'barcelona', 'amsterdam', 'zurich', 'dublin', 'copenhagen', 'stockholm',
    'mexico city', 'guadalajara', 'monterrey', 'bogota', 'medellin', 'buenos aires', 'santiago', 'lima', 'sao paulo', 'rio',
    'toronto', 'vancouver', 'montreal', 'sydney', 'melbourne', 'singapore', 'hong kong', 'tokyo', 'bangalore', 'mumbai'
  ],
  es: [
    // Modalidades de trabajo
    'remoto', 'híbrido', 'presencial', 'oficina', 'trabajo desde casa', 'teletrabajo', 'distribuido', 'flexible', 'independiente de ubicación',
    // Regiones y Países
    'eeuu', 'estados unidos', 'américa', 'canadá', 'méxico', 'reino unido', 'europa', 'alemania', 'francia', 'españa',
    'italia', 'países bajos', 'brasil', 'argentina', 'colombia', 'chile', 'perú', 'asia', 'china', 'japón', 'india', 'singapur',
    'australia', 'nueva zelanda', 'áfrica', 'sudáfrica', 'israel', 'turquía', 'rusia', 'polonia', 'suecia', 'noruega',
    // Ciudades
    'nueva york', 'los ángeles', 'san francisco', 'chicago', 'boston', 'seattle', 'austin', 'miami', 'denver', 'atlanta',
    'londres', 'parís', 'berlín', 'madrid', 'barcelona', 'ámsterdam', 'zúrich', 'dublín', 'copenhague', 'estocolmo',
    'ciudad de méxico', 'guadalajara', 'monterrey', 'bogotá', 'medellín', 'buenos aires', 'santiago', 'lima', 'são paulo', 'río',
    'toronto', 'vancouver', 'montreal', 'sídney', 'melbourne', 'singapur', 'hong kong', 'tokio', 'bangalore', 'mumbai'
  ],
  pt: [
    // Modalidades de trabalho
    'remoto', 'híbrido', 'presencial', 'escritório', 'trabalho de casa', 'home office', 'distribuído', 'flexível', 'independente de localização',
    // Regiões e Países
    'eua', 'estados unidos', 'américa', 'canadá', 'méxico', 'reino unido', 'europa', 'alemanha', 'frança', 'espanha',
    'itália', 'países baixos', 'brasil', 'argentina', 'colômbia', 'chile', 'peru', 'ásia', 'china', 'japão', 'índia', 'singapura',
    'austrália', 'nova zelândia', 'áfrica', 'áfrica do sul', 'israel', 'turquia', 'rússia', 'polônia', 'suécia', 'noruega',
    // Cidades
    'nova york', 'los angeles', 'são francisco', 'chicago', 'boston', 'seattle', 'austin', 'miami', 'denver', 'atlanta',
    'londres', 'paris', 'berlim', 'madrid', 'barcelona', 'amsterdã', 'zurique', 'dublin', 'copenhague', 'estocolmo',
    'cidade do méxico', 'guadalajara', 'monterrey', 'bogotá', 'medellín', 'buenos aires', 'santiago', 'lima', 'são paulo', 'rio',
    'toronto', 'vancouver', 'montreal', 'sydney', 'melbourne', 'singapura', 'hong kong', 'tóquio', 'bangalore', 'mumbai'
  ],
  fr: [
    // Modalités de travail
    'télétravail', 'hybride', 'sur site', 'bureau', 'travail à domicile', 'distribué', 'flexible', 'indépendant de la localisation',
    // Régions et Pays
    'états-unis', 'amérique', 'canada', 'mexique', 'royaume-uni', 'europe', 'allemagne', 'france', 'espagne',
    'italie', 'pays-bas', 'brésil', 'argentine', 'colombie', 'chili', 'pérou', 'asie', 'chine', 'japon', 'inde', 'singapour',
    'australie', 'nouvelle-zélande', 'afrique', 'afrique du sud', 'israël', 'turquie', 'russie', 'pologne', 'suède', 'norvège',
    // Villes
    'new york', 'los angeles', 'san francisco', 'chicago', 'boston', 'seattle', 'austin', 'miami', 'denver', 'atlanta',
    'londres', 'paris', 'berlin', 'madrid', 'barcelone', 'amsterdam', 'zurich', 'dublin', 'copenhague', 'stockholm',
    'mexico', 'guadalajara', 'monterrey', 'bogotá', 'medellín', 'buenos aires', 'santiago', 'lima', 'são paulo', 'rio',
    'toronto', 'vancouver', 'montréal', 'sydney', 'melbourne', 'singapour', 'hong kong', 'tokyo', 'bangalore', 'mumbai'
  ]
}

const OUTCOME_KEYWORDS: KeywordDictionary = {
  en: [
    // Financial metrics
    'revenue', 'sales', 'profit', 'margin', 'cost', 'budget', 'roi', 'conversion', 'acquisition', 'retention', 'churn',
    'growth', 'increase', 'boost', 'double', 'triple', 'scale', 'expand', 'reach', 'achieve', 'target', 'goal', 'kpi',
    // Performance metrics
    'performance', 'efficiency', 'productivity', 'quality', 'speed', 'time', 'reduce', 'improve', 'optimize', 'streamline',
    'automate', 'enhance', 'deliver', 'launch', 'ship', 'release', 'deploy', 'implement', 'execute', 'complete',
    // User/Customer metrics
    'users', 'customers', 'engagement', 'satisfaction', 'nps', 'feedback', 'experience', 'adoption', 'usage', 'traffic',
    'leads', 'prospects', 'pipeline', 'funnel', 'market share', 'brand awareness', 'reach', 'impressions', 'clicks',
    // Team/Organizational metrics
    'team', 'hire', 'onboard', 'train', 'develop', 'promote', 'culture', 'collaboration', 'communication', 'process',
    'workflow', 'operations', 'compliance', 'security', 'risk', 'mitigation', 'innovation', 'transformation'
  ],
  es: [
    // Métricas financieras
    'ingresos', 'ventas', 'ganancia', 'margen', 'costo', 'presupuesto', 'roi', 'conversión', 'adquisición', 'retención', 'abandono',
    'crecimiento', 'aumento', 'impulso', 'doblar', 'triplicar', 'escalar', 'expandir', 'alcanzar', 'lograr', 'objetivo', 'meta', 'kpi',
    // Métricas de rendimiento
    'rendimiento', 'eficiencia', 'productividad', 'calidad', 'velocidad', 'tiempo', 'reducir', 'mejorar', 'optimizar', 'agilizar',
    'automatizar', 'potenciar', 'entregar', 'lanzar', 'enviar', 'liberar', 'desplegar', 'implementar', 'ejecutar', 'completar',
    // Métricas de usuario/cliente
    'usuarios', 'clientes', 'compromiso', 'satisfacción', 'nps', 'retroalimentación', 'experiencia', 'adopción', 'uso', 'tráfico',
    'leads', 'prospectos', 'pipeline', 'embudo', 'participación de mercado', 'conocimiento de marca', 'alcance', 'impresiones', 'clics',
    // Métricas de equipo/organización
    'equipo', 'contratar', 'incorporar', 'entrenar', 'desarrollar', 'promover', 'cultura', 'colaboración', 'comunicación', 'proceso',
    'flujo de trabajo', 'operaciones', 'cumplimiento', 'seguridad', 'riesgo', 'mitigación', 'innovación', 'transformación'
  ],
  pt: [
    // Métricas financeiras
    'receita', 'vendas', 'lucro', 'margem', 'custo', 'orçamento', 'roi', 'conversão', 'aquisição', 'retenção', 'churn',
    'crescimento', 'aumento', 'impulsionar', 'dobrar', 'triplicar', 'escalar', 'expandir', 'alcançar', 'atingir', 'objetivo', 'meta', 'kpi',
    // Métricas de desempenho
    'desempenho', 'eficiência', 'produtividade', 'qualidade', 'velocidade', 'tempo', 'reduzir', 'melhorar', 'otimizar', 'agilizar',
    'automatizar', 'aprimorar', 'entregar', 'lançar', 'enviar', 'liberar', 'implantar', 'implementar', 'executar', 'completar',
    // Métricas de usuário/cliente
    'usuários', 'clientes', 'engajamento', 'satisfação', 'nps', 'feedback', 'experiência', 'adoção', 'uso', 'tráfego',
    'leads', 'prospects', 'pipeline', 'funil', 'participação de mercado', 'conhecimento da marca', 'alcance', 'impressões', 'cliques',
    // Métricas de equipe/organização
    'equipe', 'contratar', 'integrar', 'treinar', 'desenvolver', 'promover', 'cultura', 'colaboração', 'comunicação', 'processo',
    'fluxo de trabalho', 'operações', 'conformidade', 'segurança', 'risco', 'mitigação', 'inovação', 'transformação'
  ],
  fr: [
    // Métriques financières
    'revenu', 'ventes', 'profit', 'marge', 'coût', 'budget', 'roi', 'conversion', 'acquisition', 'rétention', 'attrition',
    'croissance', 'augmentation', 'stimuler', 'doubler', 'tripler', 'mettre à l\'échelle', 'étendre', 'atteindre', 'réaliser', 'objectif', 'but', 'kpi',
    // Métriques de performance
    'performance', 'efficacité', 'productivité', 'qualité', 'vitesse', 'temps', 'réduire', 'améliorer', 'optimiser', 'rationaliser',
    'automatiser', 'améliorer', 'livrer', 'lancer', 'expédier', 'libérer', 'déployer', 'mettre en œuvre', 'exécuter', 'compléter',
    // Métriques utilisateur/client
    'utilisateurs', 'clients', 'engagement', 'satisfaction', 'nps', 'retour', 'expérience', 'adoption', 'utilisation', 'trafic',
    'leads', 'prospects', 'pipeline', 'entonnoir', 'part de marché', 'notoriété de marque', 'portée', 'impressions', 'clics',
    // Métriques équipe/organisation
    'équipe', 'embaucher', 'intégrer', 'former', 'développer', 'promouvoir', 'culture', 'collaboration', 'communication', 'processus',
    'flux de travail', 'opérations', 'conformité', 'sécurité', 'risque', 'atténuation', 'innovation', 'transformation'
  ]
}

// Compiled regex patterns for optimal performance
class CompiledValidationPatterns {
  private static instance: CompiledValidationPatterns
  private patterns: Map<string, RegExp> = new Map()

  private constructor() {
    this.compilePatterns()
  }

  static getInstance(): CompiledValidationPatterns {
    if (!CompiledValidationPatterns.instance) {
      CompiledValidationPatterns.instance = new CompiledValidationPatterns()
    }
    return CompiledValidationPatterns.instance
  }

  private compilePatterns() {
    // Compile role patterns
    const rolePattern = this.createMultiLanguagePattern(ROLE_KEYWORDS)
    this.patterns.set('role', rolePattern)

    // Compile responsibility patterns
    const responsibilityPattern = this.createMultiLanguagePattern(RESPONSIBILITY_KEYWORDS)
    this.patterns.set('responsibilities', responsibilityPattern)

    // Compile industry patterns
    const industryPattern = this.createMultiLanguagePattern(INDUSTRY_KEYWORDS)
    this.patterns.set('industry', industryPattern)

    // Compile location patterns
    const locationPattern = this.createMultiLanguagePattern(LOCATION_KEYWORDS)
    this.patterns.set('location', locationPattern)

    // Compile outcome patterns
    const outcomePattern = this.createMultiLanguagePattern(OUTCOME_KEYWORDS)
    this.patterns.set('outcomes', outcomePattern)
  }

  private createMultiLanguagePattern(keywords: KeywordDictionary): RegExp {
    // Combine all languages and create word boundary regex
    const allKeywords = [
      ...keywords.en,
      ...keywords.es,
      ...keywords.pt,
      ...keywords.fr
    ]
    
    // Sort by length (longest first) to prevent shorter matches from blocking longer ones
    const sortedKeywords = allKeywords.sort((a, b) => b.length - a.length)
    
    // Escape special regex characters and create word boundaries
    const escapedKeywords = sortedKeywords.map(keyword => 
      keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    
    // Create pattern with word boundaries for better accuracy
    const pattern = `\\b(${escapedKeywords.join('|')})\\b`
    
    return new RegExp(pattern, 'i')
  }

  getPattern(type: string): RegExp | undefined {
    return this.patterns.get(type)
  }
}

// Main validation interface
export interface ValidationItem {
  id: string
  label: string
  checked: boolean
}

export function validateJobPrompt(text: string): ValidationItem[] {
  const patterns = CompiledValidationPatterns.getInstance()
  
  return [
    {
      id: 'role',
      label: 'Role or position title',
      checked: patterns.getPattern('role')?.test(text) ?? false
    },
    {
      id: 'responsibilities',
      label: 'Key responsibilities or goals',
      checked: patterns.getPattern('responsibilities')?.test(text) ?? false
    },
    {
      id: 'industry',
      label: 'Industry or team context',
      checked: patterns.getPattern('industry')?.test(text) ?? false
    },
    {
      id: 'location',
      label: 'Location or region',
      checked: patterns.getPattern('location')?.test(text) ?? false
    },
    {
      id: 'outcomes',
      label: 'Desired outcomes or metrics',
      checked: patterns.getPattern('outcomes')?.test(text) ?? false
    }
  ]
}

// Utility function to get validation statistics
export function getValidationStats(text: string) {
  const validation = validateJobPrompt(text)
  const validCount = validation.filter(item => item.checked).length
  const totalCount = validation.length
  
  return {
    validCount,
    totalCount,
    completionPercentage: Math.round((validCount / totalCount) * 100),
    missingCategories: validation.filter(item => !item.checked).map(item => item.label)
  }
}