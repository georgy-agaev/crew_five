# Enrichment Results — `ucmsgroup.ru`, `topframe.ru`, `voicexpert.ru`

> Generated: 2025-12-27T07:31:49.593Z
>
> Providers requested: **EXA**, **Parallel**, **Firecrawl**, **AnySite**

This document captures **raw, provider-specific enrichment outputs** (or provider errors) for three real-world
domains. This is intentionally **pre-schema**: the goal is to see what we can reliably get from each provider
before locking a fixed normalized schema.

## Provider Status (This Run)

- **EXA**: ✅ succeeded for all 3 domains via `POST /answer`. Responses contained **no `sources[]`** in this run.
- **Firecrawl**: ✅ succeeded for all 3 domains via `POST /v1/scrape` (markdown extracted).
- **AnySite**:
  - ✅ `ucmsgroup.ru`: succeeded (web parser + LinkedIn lookup + LinkedIn company details)
  - ✅ `topframe.ru`: succeeded (web parser), LinkedIn lookup returned no matches
  - ⚠️ `voicexpert.ru`: web parser returned **502 content** (site-side), LinkedIn lookup returned no matches
- **Parallel**: ❌ cannot fetch any enrichment output with the current `PARALLEL_API_KEY` (API gateway rejects key).

## 1) `ucmsgroup.ru`

### EXA — `POST /answer`

**Answer**

UCMS Group is a Business Process Outsourcing specialist that delivers **payroll processing, HR‑administration and
full‑cycle accounting services** (including international payroll, shared‑services finance, tax compliance and
multi‑currency bookkeeping) to companies operating in Russia and the wider Central‑Eastern European region.

Its **ideal customer profile (ICP)** consists of multinational or global corporations and midsized‑to‑large
domestic firms that need to outsource finance‑related functions in regulated markets. The firm serves ≈ 829
entities across sectors such as financial services, pharmaceuticals, distribution & logistics, manufacturing,
automotive, IT, retail, food and chemicals, making it a fit for any B2B organization seeking
to reduce payroll costs, mitigate fiscal risk and improve data‑protection compliance.

Key differentiators include **being a pioneer of outsourcing in Russia since 1995**, with local management that
eliminates call‑center bottlenecks and provides a dedicated account executive for each client.
UCMS Group is consistently ranked in the **top‑3 for payroll and HR administration** by Expert RA, holds ISO 9001,
ISAE 3402 and SSAE 18 certifications, and operates a network of offices and partners across 12 countries, backed
by international institutional investors. These credentials give prospects confidence in
quality, regulatory compliance and rapid implementation (1‑2 months).

**Sources**: none returned in this run (`sources[]` was empty).

### Firecrawl — `POST /v1/scrape`

- Title: `UCMS Group – аутсорсинг бизнес процессов, бухгалтерских, кадровых и юридических услуг`
- Description: `Аутсорсинг бизнес процессов, бухгалтерских, кадровых и юридических услуг`
- Markdown chars: `18619`

**Markdown excerpt**

```md
Аутсорсинг бизнес процессов

# UCMS Group – аутсорсинг бизнес процессов

Мы оказываем аутсорсинговые услуги по расчету заработной платы, кадровому делопроизводству и бухгалтерскому учету

[Связаться с нами](https://www.ucmsgroup.ru/#modal-feedback)

UCMS Group предоставляет аутсорсинговые услуги в России с 1995 года. Наши процессинговые центры находятся в Москве,
Санкт-Петербурге, Ярославле и Твери.

Мы занимаем **первое место** в рейтинге крупнейших компаний в области расчета заработной платы, **третье место** в области
кадрового делопроизводства, входим в **ТОП-12** по услугам бухгалтерского и налогового учета и в **ТОП-5** в общем рейтинге
крупнейших компаний в области аутсорсинга учетных функций по итогам деятельности за 2024 год (“Эксперт РА”).

30 лет

на рынке

400+

сотрудников
```

### Firecrawl Search — `POST /v1/search`

Query used: `site:ucmsgroup.ru UCMS Group payroll outsourcing`

Top results (limit=5):

- Payroll outsourcing — https://www.ucmsgroup.ru/en/services/payroll-calculation/payroll-outsourcing/
  - Paying salary on time and without mistakes is easy! … since 1995.
- Services — https://www.ucmsgroup.ru/en/services/
  - … one of the first … payroll outsourcing / HR office outsourcing …
- How does Russian IKEA use payroll outsourcing? — https://www.ucmsgroup.ru/en/cases/how-does-russian-ikea-use-payroll-outsourcing/
  - … implements security systems, ISO 9001 … quality control …
- Payroll and reporting checks — https://www.ucmsgroup.ru/en/services/payroll-calculation/payroll-and-reporting-checks/
  - HR/Payroll expert … Payroll outsourcing … checks …
- Payroll calculation | Services UCMS Group — https://www.ucmsgroup.ru/en/services/payroll-calculation/
  - … reduce the burden on your current finance staff …

### AnySite

#### Web parser — `POST /api/webparser/parse`

- Title: `UCMS Group – аутсорсинг бизнес процессов, бухгалтерских, кадровых и юридических услуг`
- `emails`: `null`
- `phones`: `null`
- `links`: `null` (not returned for this page in this run)

#### LinkedIn search — `POST /api/linkedin/google/company`

Top results:

- `Payroll Outsourcing - UCMS GROUP` (`alias=payroll-outsoursing`)
- `UCMS Group Russia` (`alias=ucms-group-russia`)

#### LinkedIn company — `POST /api/linkedin/company`

Matched company (from first result):

- Name: `Payroll Outsourcing - UCMS GROUP`
- URL: `https://www.linkedin.com/showcase/payroll-outsoursing/`
- Website: `http://www.ucmsgroup.ru/ru/services/payroll-outsourcing/payroll-processing/`
- Description (excerpt): `Аутсорсинг расчета заработной платы … Фокусируйтесь на более важных вещах в бизнесе.`

## 2) `topframe.ru`

### EXA — `POST /answer`

**Answer**

I’m sorry, but the provided search results do not contain any information about the company Topframe
(https://topframe.ru). Without source material describing what Topframe sells, its ideal customer profile, or its
differentiators, I can’t create a reliable B2B‑sales summary. If you can share specific content from the site or
other sources, I’d be happy to synthesize it for you.

**Sources**: none returned in this run (`sources[]` was empty).

### Firecrawl — `POST /v1/scrape`

- Title: `Сюрвейерские услуги — профессиональное обслуживание по России и миру от компании ТопФрейм`
- Description (excerpt): `Сюрвейерские услуги и экспертиза … звоните: +7 (812) 448-04-02`
- Markdown chars: `11855`

**Markdown excerpt**

```md
Отправить заявку

на услугу

Строительный контроль
Инвентаризация товаров
Курс обучения «Товароведение и экспертиза свежих плодов и овощей»
Аудит поставщика
Контроль качества товара на производстве
Осмотр залогового имущества
...
Сюрвейерские инспекции
Экспертиза фруктов и овощей
...
Инспекции нефти и нефтепродуктов
```

### Firecrawl Search — `POST /v1/search`

Query used: `site:topframe.ru ТопФрейм сюрвейерские услуги`

Top results (limit=5):

- Сюрвейерские услуги — профессиональное обслуживание по России и миру от компании ТопФрейм — https://www.topframe.ru/
  - … Сюрвейерские услуги и экспертиза … +7 (812) 448-04-02

### AnySite

#### Web parser — `POST /api/webparser/parse`

- Title: `Сюрвейерские услуги — профессиональное обслуживание по России и миру от компании ТопФрейм`
- `emails`: `null`
- `phones`: `null`
- `links`: `null` (not returned for this page in this run)

#### LinkedIn search — `POST /api/linkedin/google/company`

- Result: `[]` (no matches returned for keywords `[topframe.ru, Topframe]` in this run)

## 3) `voicexpert.ru`

### EXA — `POST /answer`

**Answer**

I’m sorry, but the provided search results do not contain any information about Voicexpert (e.g., what products or
services they sell, their ideal customer profile, or any differentiating factors). Without source material that
specifically describes the company, I can’t create an accurate B2B‑sales summary. If you can share relevant
content from the voicexpert.ru site or other sources, I’d be happy to synthesize it for you.

**Sources**: none returned in this run (`sources[]` was empty).

### Firecrawl — `POST /v1/scrape`

- Title: `VoiceXpert - официальный сайт в России`
- Description: `Официальный сайт VoiceXpert в России: техподдержка, где купить, описания и технические характеристики товаров - voicexpert.ru`
- Markdown chars: `9614`

**Markdown excerpt**

```md
[![VoiceXpert](https://voicexpert.ru/site/voicexpert/image/VoiceXpert-logo-NY.png)](https://voicexpert.ru/)

[![](https://voicexpert.ru/site/voicexpert/image/tg.png)](https://t.me/voicexpert)
[![](https://voicexpert.ru/site/voicexpert/image/vk.png)](https://vk.com/voicevideoexpert)
Заказать звонок

...
```

### Firecrawl Search — `POST /v1/search`

Query used: `site:voicexpert.ru VoiceXpert официальный сайт`

Top results (limit=5):

- VoiceXpert - официальный сайт в России — https://voicexpert.ru/
  - Официальный сайт VoiceXpert … где купить … характеристики …
- Новости — https://voicexpert.ru/news/
  - Новинки на складе … Скидка 10% на гарнитуры …
- Смотрите новое видео "Обзор и сравнение гарнитур …" — https://voicexpert.ru/news/20250522/smotrite-novoe-video-obzor-i-sravnenie-garnitur-voicexpert-vxh-300d-i-yealink-uh34-dual-uc-vneshnij-vid-funkcii/
  - VoiceXpert VXH-300D … четкий звук … шумоподавление …
- Новые PTZ-камеры VoiceXpert с управлением жестами … — https://voicexpert.ru/news/20250904/novye-ptz-kamery-voicexpert-s-upravleniem-zhestami-uzhe-na-sklade/
  - В наличии … PTZ видеокамеры VoiceXpert … 4K …
- Отзывы о тестировании и товарах VoiceXpert — https://voicexpert.ru/otzyvy/
  - … Voicexpert.ru … info@voicexpert.ru …

### AnySite

The initial batch run returned a transient `fetch failed` error. A targeted retry succeeded but indicates the site
returns **502** to the AnySite web parser at the time of this run.

#### Web parser (retry) — `POST /api/webparser/parse`

- Title: `502 Bad Gateway`
- `cleaned_html` (excerpt): `<center><h1>502 Bad Gateway</h1></center> ... nginx/1.14.2 ...`
- `emails`: `null`
- `phones`: `null`

#### LinkedIn search (retry) — `POST /api/linkedin/google/company`

- Result: `[]` (no matches returned for keywords `[voicexpert.ru, VoiceXpert, ...]` in this run)

## Parallel Probe (Not Domain-Specific)

Parallel API is reachable, but the gateway rejects the current API key for the product routes.

- `GET https://api.parallel.ai/health` → `200 OK`
- `GET https://api.parallel.ai/openapi.json` → `401` (“Failed to resolve API Key …”)
- `GET https://api.parallel.ai/openapi.json` with `Authorization: Bearer <key>` / `x-api-key: <key>` → `401`
  (“Invalid ApiKey for given resource”)

**Result**: no Parallel enrichment output could be collected for the requested domains without a working key /
correct product access.
