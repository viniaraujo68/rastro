FROM mcr.microsoft.com/devcontainers/go:1.26-bookworm

# Docker CLI — binário estático, sem apt nem GPG.
RUN curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-29.2.0.tgz" \
    | tar xz --strip-components=1 -C /usr/local/bin docker/docker && \
    groupadd -f docker && \
    usermod -aG docker vscode

# Supabase CLI — binário estático, sem dependências.
RUN curl -fsSL \
    https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \
    | tar xz -C /usr/local/bin supabase
