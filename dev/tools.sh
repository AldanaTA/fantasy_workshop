#!/usr/bin/env bash

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/tools"

ACTION="${1:-}"
TARGET="${2:-all}"

usage() {
    echo "Usage:"
    echo "  $0 up [tool|all]"
    echo "  $0 down [tool|all]"
    echo "  $0 restart [tool|all]"
    echo "  $0 status [tool|all]"
    echo "  $0 build [tool|all]"
    echo "  $0 pull [tool|all]"
    echo "  $0 logs <tool>"
    echo
    echo "Examples:"
    echo "  $0 up all"
    echo "  $0 up tool1"
    echo "  $0 restart tool2"
    echo "  $0 status all"
    echo "  $0 logs tool1"
}

find_compose_file() {
    local tool_dir="$1"

    if [[ -f "$tool_dir/compose.yml" ]]; then
        echo "$tool_dir/compose.yml"
    elif [[ -f "$tool_dir/compose.yaml" ]]; then
        echo "$tool_dir/compose.yaml"
    elif [[ -f "$tool_dir/docker-compose.yml" ]]; then
        echo "$tool_dir/docker-compose.yml"
    elif [[ -f "$tool_dir/docker-compose.yaml" ]]; then
        echo "$tool_dir/docker-compose.yaml"
    fi
}

run_action() {
    local tool_dir="$1"
    local tool_name
    local compose_file

    tool_name="$(basename "$tool_dir")"
    compose_file="$(find_compose_file "$tool_dir")"

    if [[ -z "$compose_file" ]]; then
        echo "Skipping $tool_name: no compose file found."
        return
    fi

    echo
    echo "=== $tool_name ==="

    (
        cd "$tool_dir" || exit 1

        case "$ACTION" in
            up)
                docker compose up -d
                ;;

            down)
                docker compose down
                ;;

            restart)
                docker compose restart
                ;;

            status)
                docker compose ps
                ;;

            build)
                docker compose build
                ;;

            pull)
                docker compose pull
                ;;

            logs)
                docker compose logs -f
                ;;

            *)
                echo "Unknown action: $ACTION"
                return 1
                ;;
        esac
    )
}

run_all() {
    local found=false

    for tool_dir in "$TOOLS_DIR"/*/; do
        [[ -d "$tool_dir" ]] || continue

        found=true
        run_action "$tool_dir"
    done

    if [[ "$found" == false ]]; then
        echo "No tool directories found in:"
        echo "$TOOLS_DIR"
        exit 1
    fi
}

run_target() {
    local tool_dir="$TOOLS_DIR/$TARGET"

    if [[ ! -d "$tool_dir" ]]; then
        echo "Tool not found: $TARGET"
        exit 1
    fi

    run_action "$tool_dir"
}

if [[ -z "$ACTION" ]]; then
    usage
    exit 1
fi

case "$ACTION" in
    up|down|restart|status|build|pull)
        if [[ "$TARGET" == "all" ]]; then
            run_all
        else
            run_target
        fi
        ;;

    logs)
        if [[ "$TARGET" == "all" ]]; then
            echo "The logs command requires a specific tool."
            echo "Example: $0 logs tool1"
            exit 1
        fi

        run_target
        ;;

    *)
        usage
        exit 1
        ;;
esac