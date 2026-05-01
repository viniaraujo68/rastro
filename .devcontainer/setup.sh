#!/bin/bash
set -e

echo "==> Baixando dependências do backend..."
cd /workspaces/rastro/backend
go mod download

echo "==> Atualizando npm para a versão mais recente..."
npm install -g npm@latest --quiet

echo "==> Instalando dependências do frontend..."
cd /workspaces/rastro/frontend
npm install

echo "==> Criando arquivos .env com credenciais locais do Supabase CLI..."
cd /workspaces/rastro

if [ ! -f backend/.env ]; then
  cat > backend/.env <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0
SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
CORS_ORIGINS=http://localhost:5173
GIN_MODE=debug
PORT=8080
EOF
fi

if [ ! -f frontend/.env ]; then
  cat > frontend/.env <<'EOF'
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiJKtjluh8p38p468GG-50c65tVfEathfOEBjo
VITE_API_URL=http://localhost:8080/api/v1
EOF
fi

echo ""
echo "Ambiente pronto. Próximos passos:"
echo "  1. supabase start        (baixa imagens na 1ª vez — pode demorar ~5 min)"
echo "  2. supabase db reset     (aplica as migrations)"
echo "  3. cd backend && go run ."
echo "  4. cd frontend && npm run dev"
