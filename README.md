# Rastro

Plataforma pessoal de rastreamento de localização em tempo real. O iPhone envia coordenadas via Apple Shortcuts; o site exibe trajetos, posição atual e histórico em mapas interativos.

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Go 1.22+ + Gin |
| Frontend | React 18 + Vite + TypeScript |
| Mapas | Leaflet + react-leaflet |
| Banco | Supabase (PostgreSQL + Auth + RLS) |
| Proxy / HTTPS | Cloudflare (nuvem laranja ativa) |

---

## Arquitetura de deploy

```
Usuário → Cloudflare (HTTPS + CDN + DDoS) → VPS porta 80 → nginx → /api/* → backend:8080
```

O HTTPS é gerenciado inteiramente pelo Cloudflare (proxy ativo, ícone de nuvem laranja). O servidor VPS só precisa escutar na porta 80. No painel do Cloudflare, configure **SSL/TLS → Overview** como **Flexible** (Cloudflare↔servidor via HTTP) ou **Full** (se quiser TLS no trecho interno também).

---

## Pré-requisitos

- [Supabase](https://supabase.com) — projeto criado (gratuito)
- [Cloudflare](https://cloudflare.com) — domínio apontando pro Cloudflare com proxy ativo (nuvem laranja)
- Docker + Docker Compose (para deploy)
- Node.js 20+ (para desenvolvimento local do frontend)
- Go 1.22+ (para desenvolvimento local do backend)

---

## 1. Configurar o Supabase

### 1.1 Criar as tabelas

No **SQL Editor** do seu projeto Supabase, execute o script completo em [`docs/migrations.sql`](docs/migrations.sql) (ou copie o bloco abaixo).

<details>
<summary>Ver SQL completo</summary>

```sql
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can manage own devices"
    ON devices FOR ALL USING (owner_id = auth.uid());

CREATE TABLE device_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    permission TEXT NOT NULL DEFAULT 'view',
    granted_by UUID REFERENCES auth.users(id) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(device_id, user_id)
);
ALTER TABLE device_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can see their own permissions"
    ON device_permissions FOR SELECT
    USING (user_id = auth.uid() OR granted_by = auth.uid());
CREATE POLICY "Device owner can manage permissions"
    ON device_permissions FOR ALL USING (granted_by = auth.uid());

CREATE TABLE locations (
    id BIGSERIAL PRIMARY KEY,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    accuracy DOUBLE PRECISION,
    altitude DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    battery_level INTEGER,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view authorized locations"
    ON locations FOR SELECT
    USING (
        device_id IN (
            SELECT id FROM devices WHERE owner_id = auth.uid()
            UNION
            SELECT device_id FROM device_permissions WHERE user_id = auth.uid()
        )
    );
CREATE POLICY "Service can insert locations"
    ON locations FOR INSERT WITH CHECK (true);

CREATE INDEX idx_locations_device_timestamp ON locations(device_id, timestamp DESC);
CREATE INDEX idx_locations_timestamp ON locations(timestamp DESC);
CREATE INDEX idx_devices_api_key ON devices(api_key);
CREATE INDEX idx_devices_owner ON devices(owner_id);
CREATE INDEX idx_permissions_user ON device_permissions(user_id);
CREATE INDEX idx_permissions_device ON device_permissions(device_id);
```

</details>

### 1.2 Coletar as credenciais

Em **Project Settings → API**:

| Variável | Onde encontrar |
|----------|---------------|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_KEY` | `service_role` secret |
| `VITE_SUPABASE_ANON_KEY` | `anon` public key |

Em **Project Settings → API → JWT Settings**:

| Variável | Onde encontrar |
|----------|---------------|
| `SUPABASE_JWT_SECRET` | JWT Secret |

Em **Project Settings → Database → Connection string** (modo `URI`):

| Variável | Onde encontrar |
|----------|---------------|
| `DATABASE_URL` | Connection string (substitua `[YOUR-PASSWORD]`) |

---

## 2. Variáveis de ambiente

```bash
cp .env.example .env
```

Edite `.env` com as credenciais coletadas acima:

```env
# Backend
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.PROJETO.supabase.co:5432/postgres
SUPABASE_URL=https://PROJETO.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=seu-jwt-secret
CORS_ORIGINS=https://seu-dominio.com

# Frontend (embutido no bundle em build time)
VITE_SUPABASE_URL=https://PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 3. Deploy com Docker

```bash
docker compose up -d --build
```

- Frontend: `http://SEU_DOMINIO` — o Cloudflare termina o HTTPS e faz proxy para a porta 80 do VPS
- Backend: acessível apenas internamente via `http://backend:8080` (sem porta exposta ao host)

Para ver os logs:

```bash
docker compose logs -f
```

---

## 4. Desenvolvimento local

### Backend

```bash
cd backend
cp .env.example .env   # preencher credenciais
go run .
# Servidor em http://localhost:8080
```

### Frontend

```bash
cd frontend
cp .env.example .env   # preencher VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev
# App em http://localhost:5173
```

O Vite já está configurado com proxy: requisições para `/api` são redirecionadas para `localhost:8080`.

---

## 5. Criar seu primeiro device

1. Acesse o site e crie uma conta (email + senha ou magic link)
2. Vá em **Devices → Novo device**
3. Dê um nome (ex: "iPhone")
4. Copie a **API Key** exibida — ela só aparece uma vez

---

## 6. Configurar o Apple Shortcut

O Shortcut envia sua localização para o Rastro automaticamente a cada X minutos.

### 6.1 Criar o Shortcut

1. Abra o app **Atalhos** no iPhone
2. Toque em **+** para criar novo atalho
3. Adicione as seguintes ações na ordem:

**Ação 1 — Obter localização atual**
- Buscar por "Localização" → **Obter Localização Atual**
- Precisão: **Melhor**

**Ação 2 — Obter nível de bateria**
- Buscar por "Bateria" → **Obter Nível da Bateria**

**Ação 3 — Montar o JSON**
- Adicionar ação **Texto** com o conteúdo abaixo (substitua os valores entre `«»` pelas variáveis do passo anterior):

```
{
  "latitude": «Localização Atual.Latitude»,
  "longitude": «Localização Atual.Longitude»,
  "address": "«Localização Atual.Endereço»",
  "accuracy": «Localização Atual.Precisão Horizontal»,
  "altitude": «Localização Atual.Altitude»,
  "speed": 0,
  "battery_level": «Nível da Bateria»,
  "timestamp": "«Data Atual» (formato ISO 8601)"
}
```

> **Dica:** Para o timestamp, use a ação **Formatar Data** com formato `ISO 8601`.

**Ação 4 — Enviar HTTP**
- Buscar por "URL" → **Obter Conteúdo da URL**
- **URL:** `https://SEU_DOMINIO/api/v1/location`
- **Método:** POST
- **Cabeçalhos:**
  - `X-Device-Key`: sua API key
  - `Content-Type`: `application/json`
- **Corpo da requisição:** Texto → selecione o resultado da Ação 3

### 6.2 Automatizar a execução

1. Na aba **Automação**, toque em **+**
2. Escolha **Hora do Dia**
3. Configure para repetir a cada **15 minutos** (ou o intervalo desejado)
4. Selecione o atalho criado
5. Desative "Perguntar antes de executar"

> **Nota:** Automações no iPhone requerem iOS 13.1+. Para rastreamento contínuo em background, considere apps como **Scriptable** ou **Owntracks** que têm suporte nativo a background location.

---

## 7. Funcionalidades

| Funcionalidade | Descrição |
|---------------|-----------|
| **Tempo Real** | Última posição com atualização automática a cada 30s |
| **Trajeto** | Polyline do percurso com Timeline lateral clicável |
| **Heatmap** | Mapa de calor de frequência de visitas |
| **Stats** | Distância total, duração, velocidade média, bateria |
| **Permissões** | Compartilhe acesso por email (somente visualização ou admin) |
| **Multi-device** | Suporte a múltiplos dispositivos por conta |

---

## 8. API Reference

### Ingestão (autenticação por API Key)

```
POST /api/v1/location
X-Device-Key: rk_...

{
  "latitude": -22.9068,
  "longitude": -43.1729,
  "address": "Av. Atlântica, 1702",
  "accuracy": 10.5,
  "altitude": 8.2,
  "speed": 0.0,
  "battery_level": 72,
  "timestamp": "2025-12-02T16:09:59-03:00"
}
```

### Consultas (autenticação por JWT)

```
GET /api/v1/locations?device_id=UUID&from=ISO8601&to=ISO8601&limit=1000
GET /api/v1/locations/latest?device_id=UUID
GET /api/v1/devices
POST /api/v1/devices
PUT /api/v1/devices/:id
DELETE /api/v1/devices/:id
POST /api/v1/devices/:id/rotate-key
GET /api/v1/devices/:id/permissions
POST /api/v1/devices/:id/permissions
DELETE /api/v1/devices/:id/permissions/:user_id
GET /api/v1/health
```

---

## 9. Estrutura do projeto

```
rastro/
├── backend/          # Go + Gin
│   ├── config/       # Variáveis de ambiente
│   ├── db/           # Conexão pgx
│   ├── handlers/     # HTTP handlers
│   ├── middleware/   # JWT + API Key auth + rate limiting
│   ├── models/       # Structs
│   ├── services/     # Lógica de negócio
│   └── Dockerfile
├── frontend/         # React + Vite + TypeScript
│   ├── src/
│   │   ├── components/   # Map, Controls, Timeline, Stats, Devices, Permissions, Layout
│   │   ├── hooks/        # useAuth, useDevices, useLocations
│   │   ├── lib/          # supabase.ts, api.ts
│   │   ├── pages/        # Login, Dashboard, Devices, Settings
│   │   └── types/        # TypeScript types
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```
