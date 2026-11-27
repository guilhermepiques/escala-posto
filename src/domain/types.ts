// Tipos centrais do domínio da escala.

/** Data no formato AAAA-MM-DD. */
export type ISODate = string;
/** Mês no formato AAAA-MM. */
export type MonthKey = string;

export type Team = 'dia' | 'noite';

export interface Shift {
  id: string;
  /** Nome curto mostrado na grade, ex.: "M", "T", "N". */
  code: string;
  name: string;
  /** Hora de início "HH:MM". */
  start: string;
  /** Hora de término "HH:MM" (se menor que o início, termina no dia seguinte). */
  end: string;
  /** Intervalo de descanso/refeição em minutos (não conta como trabalho). */
  breakMinutes: number;
  /** Início do intervalo "HH:MM". Se vazio, fica no meio do turno. */
  breakStart?: string;
  team: Team;
  color: string;
}

export interface Absence {
  id: string;
  type: 'ferias' | 'atestado' | 'afastamento' | 'maternidade' | 'outro';
  start: ISODate;
  end: ISODate;
  note?: string;
}

export interface Employee {
  id: string;
  name: string;
  female: boolean;
  /** Equipe: "dia" roda entre manhã e tarde; "noite" faz a madrugada. */
  team: Team;
  /** Se preenchido, a pessoa fica só neste turno (ex.: só manhã). Vazio = rodízio. */
  fixedShiftId?: string;
  active: boolean;
  absences: Absence[];
  notes?: string;
}

export interface SlotDemand {
  /** Quantidade ideal de pessoas. */
  ideal: number;
  /** Quantidade mínima aceitável (abaixo disso é alerta forte). */
  min: number;
}

/** Demanda por dia da semana (0 = domingo ... 6 = sábado) e por turno. */
export type Demand = Record<number, Record<string, SlotDemand>>;

export interface Rules {
  /** Limite de horas semanais (42 a partir de 16/12/2026; 40 a partir de 16/12/2027). */
  weeklyHoursLimit: number;
  /** Limite diário normal de horas (8h). */
  dailyHoursLimit: number;
  /** Máximo absoluto diário, contando hora extra (CLT art. 59: 8h + 2h). */
  dailyHoursHardLimit: number;
  /** Descanso mínimo entre jornadas, em horas (CLT art. 66). */
  minRestHours: number;
  /** Folgas por semana (segunda a domingo). */
  restDaysPerWeek: number;
  /** Máximo de dias seguidos de trabalho. */
  maxConsecutiveDays: number;
  /** A folga deve cair no domingo pelo menos a cada N semanas (CCT cl. 6.2). */
  sundayEveryWeeks: number;
  /** Para mulheres (CLT art. 386 / CCT cl. 6.2.1). */
  sundayEveryWeeksWomen: number;
  /** Proibir que a mesma pessoa trabalhe turnos de dia e de noite no mesmo mês. */
  forbidDayNightMix: boolean;
  /**
   * Descanso exigido depois de folga(s):
   * - "sumula110": 24h + 11h = 35h, qualquer que seja o número de folgas (entendimento majoritário).
   * - "estrito": 24h por folga + 11h (ex.: 2 folgas = 59h).
   */
  restAfterDayOff: 'sumula110' | 'estrito';
  /**
   * Como a equipe do dia se divide entre manhã e tarde:
   * - 'semanal': rodízio em blocos de N semanas
   * - 'fixo': cada pessoa fica sempre no mesmo turno
   * - 'livre': o gerador escolhe (mais lento)
   */
  rotation: 'semanal' | 'fixo' | 'livre';
  /** Além da semana de segunda a domingo, exigir 2 folgas também em cada semana de domingo a sábado. */
  alsoSundayWeeks: boolean;
  /** No rodízio semanal: troca de turno a cada N semanas (1 ou 2). */
  rotationEveryWeeks: number;
  /** Dia da semana em que começa cada bloco do rodízio (0 = domingo ... 6 = sábado). */
  rotationStartWeekday: number;
}

export interface Holiday {
  date: ISODate;
  name: string;
}

export type Movement = 'alto' | 'normal' | 'baixo';

export type RestrictionType = 'naoJuntos' | 'diaDeFolga' | 'peloMenosUm';

export interface Restriction {
  id: string;
  type: RestrictionType;
  /** naoJuntos: 2 ou mais pessoas que não podem ficar no mesmo turno.
   *  diaDeFolga: a pessoa (1) que nunca trabalha nos dias da semana indicados.
   *  peloMenosUm: grupo do qual pelo menos 1 deve estar em cada turno em que trabalham. */
  employeeIds: string[];
  /** Só para diaDeFolga: dias da semana (0 = domingo ... 6 = sábado). */
  weekdays?: number[];
  note?: string;
}

export interface AppConfig {
  /** Nome do posto (aparece no topo e na impressão). */
  businessName?: string;
  shifts: Shift[];
  /** Demanda manual por dia/turno (usada quando demandMode = 'manual'). */
  demand: Demand;
  /** 'auto': calcula as pessoas por turno pelo movimento de cada dia e pelo tamanho da equipe. */
  demandMode: 'auto' | 'manual';
  /** Movimento de cada dia da semana (0 = domingo ... 6 = sábado). */
  movement: Record<number, Movement>;
  /** Mínimo de pessoas em cada turno (no modo automático). */
  minPerShift: Record<string, number>;
  rules: Rules;
  restrictions: Restriction[];
  /** Feriados extras (municipais etc.). Os nacionais e estaduais são automáticos. */
  customHolidays: Holiday[];
  /** Datas a partir das quais o limite semanal muda automaticamente. */
  updatedAt?: number;
}

/** Atribuições: funcionário -> data -> id do turno. Dia ausente = folga. */
export type Assignments = Record<string, Record<ISODate, string>>;

export interface Schedule {
  month: MonthKey;
  assignments: Assignments;
  /** Células travadas manualmente (o gerador respeita). funcionário -> data -> true */
  locked?: Record<string, Record<ISODate, boolean>>;
  generatedAt?: number;
  updatedAt?: number;
  reviewedAt?: number;
  reviewOk?: boolean;
}

export type Severity = 'erro' | 'atencao' | 'aviso';

export interface Issue {
  severity: Severity;
  code: string;
  employeeId?: string;
  date?: ISODate;
  shiftId?: string;
  title: string;
  detail: string;
  /** Base legal ou cláusula. */
  basis?: string;
  suggestion?: string;
}
