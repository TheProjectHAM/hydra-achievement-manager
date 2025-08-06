#!/bin/bash

# Hydra Achievement Manager Build Script
# Este script automatiza o processo de build para múltiplas plataformas

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir mensagens coloridas
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se o Node.js está instalado
if ! command -v node &> /dev/null; then
    print_error "Node.js não está instalado. Por favor, instale o Node.js primeiro."
    exit 1
fi

# Verificar se o yarn está instalado
if ! command -v yarn &> /dev/null; then
    print_error "Yarn não está instalado. Por favor, instale o Yarn primeiro."
    exit 1
fi

# Função para mostrar ajuda
show_help() {
    echo "Uso: $0 [OPÇÃO]"
    echo ""
    echo "Opções:"
    echo "  all         Build para todas as plataformas (Windows + Linux)"
    echo "  windows     Build apenas para Windows (x64 + x86)"
    echo "  linux       Build para todas as distribuições Linux"
    echo "  deb         Build apenas para Debian/Ubuntu (.deb)"
    echo "  rpm         Build apenas para Fedora/RHEL/SUSE (.rpm)"
    echo "  arch        Build apenas para Arch Linux (.tar.xz)"
    echo "  appimage    Build apenas AppImage (universal Linux)"
    echo "  clean       Limpar diretório de build"
    echo "  help        Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 all      # Build para todas as plataformas"
    echo "  $0 linux    # Build apenas para Linux"
    echo "  $0 deb      # Build apenas .deb para Debian/Ubuntu"
}

# Função para limpar builds anteriores
clean_build() {
    print_status "Limpando builds anteriores..."
    if [ -d "dist" ]; then
        rm -rf dist
        print_success "Diretório dist limpo"
    fi
    if [ -d "node_modules/.cache" ]; then
        rm -rf node_modules/.cache
        print_success "Cache do node_modules limpo"
    fi
}

# Função para instalar dependências
install_deps() {
    print_status "Verificando dependências..."
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.yarn-integrity" ]; then
        print_status "Instalando dependências..."
        yarn install
        print_success "Dependências instaladas"
    else
        print_success "Dependências já instaladas"
    fi
}

# Função para build Windows
build_windows() {
    print_status "Iniciando build para Windows..."
    yarn build:win
    print_success "Build Windows concluído"
}

# Função para build Linux completo
build_linux() {
    print_status "Iniciando build para Linux (todas as distribuições)..."
    yarn build:linux-all
    print_success "Build Linux concluído"
}

# Função para build Debian/Ubuntu
build_deb() {
    print_status "Iniciando build para Debian/Ubuntu (.deb)..."
    yarn build:deb
    print_success "Build .deb concluído"
}

# Função para build Fedora/RHEL
build_rpm() {
    print_status "Iniciando build para Fedora/RHEL (.rpm)..."
    yarn build:rpm
    print_success "Build .rpm concluído"
}

# Função para build Arch Linux
build_arch() {
    print_status "Iniciando build para Arch Linux (.tar.xz)..."
    yarn build:arch
    print_success "Build .tar.xz concluído"
}

# Função para build AppImage
build_appimage() {
    print_status "Iniciando build AppImage..."
    yarn build:appimage
    print_success "Build AppImage concluído"
}

# Função para build completo
build_all() {
    print_status "Iniciando build para todas as plataformas..."
    yarn build:all
    print_success "Build completo concluído"
}

# Função para mostrar estatísticas dos arquivos gerados
show_stats() {
    if [ -d "dist" ]; then
        print_status "Arquivos gerados:"
        echo ""
        find dist -name "*.exe" -o -name "*.deb" -o -name "*.rpm" -o -name "*.tar.xz" -o -name "*.AppImage" -o -name "*.zip" | while read file; do
            size=$(du -h "$file" | cut -f1)
            echo "  📦 $(basename "$file") - $size"
        done
        echo ""
        total_size=$(du -sh dist | cut -f1)
        print_success "Tamanho total: $total_size"
    fi
}

# Verificar argumentos
if [ $# -eq 0 ]; then
    show_help
    exit 1
fi

# Processar argumentos
case $1 in
    "all")
        install_deps
        clean_build
        build_all
        show_stats
        ;;
    "windows")
        install_deps
        clean_build
        build_windows
        show_stats
        ;;
    "linux")
        install_deps
        clean_build
        build_linux
        show_stats
        ;;
    "deb")
        install_deps
        clean_build
        build_deb
        show_stats
        ;;
    "rpm")
        install_deps
        clean_build
        build_rpm
        show_stats
        ;;
    "arch")
        install_deps
        clean_build
        build_arch
        show_stats
        ;;
    "appimage")
        install_deps
        clean_build
        build_appimage
        show_stats
        ;;
    "clean")
        clean_build
        ;;
    "help")
        show_help
        ;;
    *)
        print_error "Opção inválida: $1"
        show_help
        exit 1
        ;;
esac

print_success "Processo concluído!"