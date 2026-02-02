#!/bin/bash
#
# GitDiscover Production Deployment Script
#
# Usage: ./scripts/deploy.sh [options]
# Options:
#   --skip-build    Skip Docker image build
#   --skip-migrate  Skip database migrations
#   --rollback      Rollback to previous version
#   --help          Show this help message
#

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker/docker-compose.stack.yml"
ENV_FILE="$PROJECT_DIR/.env"
BACKUP_DIR="/backups/deployments"
LOG_FILE="/var/log/gitdiscover-deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Flags
SKIP_BUILD=false
SKIP_MIGRATE=false
ROLLBACK=false
VERBOSE=false

# =============================================================================
# Helper Functions
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Write to log file
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE" 2>/dev/null || true

    # Print to console with colors
    case "$level" in
        ERROR)
            echo -e "${RED}✗ $message${NC}" >&2
            ;;
        SUCCESS)
            echo -e "${GREEN}✓ $message${NC}"
            ;;
        WARN)
            echo -e "${YELLOW}⚠ $message${NC}"
            ;;
        INFO)
            echo -e "${BLUE}ℹ $message${NC}"
            ;;
        *)
            echo "$message"
            ;;
    esac
}

error_exit() {
    log ERROR "$1"
    exit 1
}

success() {
    log SUCCESS "$1"
}

info() {
    log INFO "$1"
}

warn() {
    log WARN "$1"
}

# =============================================================================
# Validation Functions
# =============================================================================

check_prerequisites() {
    info "Checking prerequisites..."

    # Check if running as root (for production)
    if [[ $EUID -ne 0 ]]; then
        warn "Not running as root. Some operations may fail."
    fi

    # Check Docker
    if ! command -v docker &> /dev/null; then
        error_exit "Docker is not installed"
    fi

    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        error_exit "Docker Compose v2 is not installed"
    fi

    # Check if compose file exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        error_exit "Compose file not found: $COMPOSE_FILE"
    fi

    # Check if .env file exists
    if [[ ! -f "$ENV_FILE" ]]; then
        error_exit "Environment file not found: $ENV_FILE"
    fi

    # Check if we're in the right directory
    if [[ ! -d "$PROJECT_DIR/apps" ]]; then
        error_exit "Not in project root directory"
    fi

    success "Prerequisites check passed"
}

check_disk_space() {
    info "Checking disk space..."

    local available=$(df / | tail -1 | awk '{print $4}')
    local required=1048576  # 1GB in KB

    if [[ $available -lt $required ]]; then
        error_exit "Insufficient disk space. Required: 1GB, Available: $(($available / 1024))MB"
    fi

    success "Disk space check passed"
}

check_port_availability() {
    info "Checking port availability..."

    local ports=(3001 3002 3003)

    for port in "${ports[@]}"; do
        if ss -tlnp 2>/dev/null | grep -q ":$port "; then
            # Check if it's our service
            if docker compose -f "$COMPOSE_FILE" ps 2>/dev/null | grep -q ":$port"; then
                info "Port $port is used by GitDiscover service (expected)"
            else
                error_exit "Port $port is already in use by another process"
            fi
        fi
    done

    success "Port availability check passed"
}

# =============================================================================
# Backup Functions
# =============================================================================

create_backup() {
    info "Creating pre-deployment backup..."

    mkdir -p "$BACKUP_DIR"

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/pre_deploy_$timestamp.dump"

    # Backup database
    if docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "running"; then
        info "Backing up database..."
        docker compose -f "$COMPOSE_FILE" exec -T postgres \
            pg_dump -U gitdiscover -Fc --no-owner --no-acl gitdiscover > "$backup_file" 2>/dev/null || {
            warn "Database backup failed, continuing anyway..."
            return 0
        }

        gzip "$backup_file"
        success "Database backup created: $backup_file.gz"

        # Store backup path for potential rollback
        echo "$backup_file.gz" > "$BACKUP_DIR/latest_backup.txt"
    else
        warn "Database not running, skipping backup"
    fi

    # Backup environment file
    cp "$ENV_FILE" "$BACKUP_DIR/env_$timestamp.backup"

    # Cleanup old backups (keep last 10)
    find "$BACKUP_DIR" -name "pre_deploy_*.dump.gz" -type f 2>/dev/null | sort -r | tail -n +11 | xargs -r rm -f
}

# =============================================================================
# Build Functions
# =============================================================================

build_images() {
    if [[ "$SKIP_BUILD" == true ]]; then
        info "Skipping Docker image build (--skip-build)"
        return 0
    fi

    info "Building Docker images..."

    cd "$PROJECT_DIR"

    # Build with no cache if VERBOSE is set
    local build_args=""
    if [[ "$VERBOSE" == true ]]; then
        build_args="--no-cache --progress=plain"
    fi

    docker compose -f "$COMPOSE_FILE" build $build_args || error_exit "Docker build failed"

    success "Docker images built successfully"
}

# =============================================================================
# Database Functions
# =============================================================================

run_migrations() {
    if [[ "$SKIP_MIGRATE" == true ]]; then
        info "Skipping database migrations (--skip-migrate)"
        return 0
    fi

    info "Running database migrations..."

    # Check if postgres is running
    if ! docker compose -f "$COMPOSE_FILE" ps postgres 2>/dev/null | grep -q "running"; then
        info "Starting PostgreSQL..."
        docker compose -f "$COMPOSE_FILE" up -d postgres

        # Wait for postgres to be ready
        local retries=30
        while [[ $retries -gt 0 ]]; do
            if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U gitdiscover &> /dev/null; then
                break
            fi
            sleep 1
            ((retries--))
        done

        if [[ $retries -eq 0 ]]; then
            error_exit "PostgreSQL failed to start"
        fi
    fi

    # Run migrations
    docker compose -f "$COMPOSE_FILE" run --rm api \
        npx prisma migrate deploy --schema apps/api/prisma/schema.prisma || error_exit "Database migration failed"

    success "Database migrations completed"
}

# =============================================================================
# Deployment Functions
# =============================================================================

deploy_services() {
    info "Deploying services..."

    cd "$PROJECT_DIR"

    # Deploy with rolling update
    docker compose -f "$COMPOSE_FILE" up -d --remove-orphans || error_exit "Deployment failed"

    success "Services deployed"
}

# =============================================================================
# Health Check Functions
# =============================================================================

run_health_checks() {
    info "Running health checks..."

    # Wait for services to be ready
    sleep 5

    # Check API health
    local api_healthy=false
    local retries=10

    while [[ $retries -gt 0 ]]; do
        if curl -sf http://localhost:3001/health &> /dev/null; then
            api_healthy=true
            break
        fi
        sleep 2
        ((retries--))
    done

    if [[ "$api_healthy" == false ]]; then
        error_exit "API health check failed"
    fi

    success "Health checks passed"
}

# =============================================================================
# Rollback Functions
# =============================================================================

rollback() {
    info "Starting rollback procedure..."

    # Get latest backup
    if [[ ! -f "$BACKUP_DIR/latest_backup.txt" ]]; then
        error_exit "No backup found for rollback"
    fi

    local backup_file=$(cat "$BACKUP_DIR/latest_backup.txt")

    if [[ ! -f "$backup_file" ]]; then
        error_exit "Backup file not found: $backup_file"
    fi

    warn "Rolling back to previous version using: $backup_file"

    # Stop services
    docker compose -f "$COMPOSE_FILE" down

    # Restore database
    info "Restoring database..."
    docker compose -f "$COMPOSE_FILE" up -d postgres
    sleep 5

    docker compose -f "$COMPOSE_FILE" exec -T postgres \
        pg_restore -U gitdiscover -d gitdiscover --clean --if-exists < "$backup_file" || {
        error_exit "Database restore failed"
    }

    # Restart services
    docker compose -f "$COMPOSE_FILE" up -d

    success "Rollback completed"
}

# =============================================================================
# Cleanup Functions
# =============================================================================

cleanup() {
    info "Cleaning up..."

    # Remove unused images
    docker image prune -f &> /dev/null || true

    # Remove old containers
    docker container prune -f &> /dev/null || true

    success "Cleanup completed"
}

# =============================================================================
# Main Function
# =============================================================================

show_help() {
    cat << EOF
GitDiscover Production Deployment Script

Usage: $(basename "$0") [options]

Options:
    --skip-build      Skip Docker image build
    --skip-migrate    Skip database migrations
    --rollback        Rollback to previous version
    --verbose         Enable verbose output
    --help            Show this help message

Examples:
    $(basename "$0")                    # Full deployment
    $(basename "$0") --skip-build       # Deploy without rebuilding
    $(basename "$0") --rollback         # Rollback to previous version

EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-migrate)
                SKIP_MIGRATE=true
                shift
                ;;
            --rollback)
                ROLLBACK=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error_exit "Unknown option: $1"
                ;;
        esac
    done
}

main() {
    parse_args "$@"

    info "=========================================="
    info "GitDiscover Deployment"
    info "Started at: $(date)"
    info "=========================================="

    # Handle rollback
    if [[ "$ROLLBACK" == true ]]; then
        rollback
        exit 0
    fi

    # Pre-deployment checks
    check_prerequisites
    check_disk_space
    check_port_availability

    # Create backup
    create_backup

    # Build and deploy
    build_images
    run_migrations
    deploy_services

    # Post-deployment checks
    run_health_checks

    # Cleanup
    cleanup

    # Success
    success "=========================================="
    success "Deployment completed successfully!"
    success "Time: $(date)"
    success "=========================================="

    # Show service status
    echo ""
    info "Service Status:"
    docker compose -f "$COMPOSE_FILE" ps

    echo ""
    info "Quick Links:"
    echo "  Health Check: curl http://localhost:3001/health"
    echo "  Logs: docker compose -f $COMPOSE_FILE logs -f"
}

# Run main function
trap 'error_exit "Deployment interrupted"' INT TERM
main "$@"
