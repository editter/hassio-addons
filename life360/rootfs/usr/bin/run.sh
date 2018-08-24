#!/usr/bin/with-contenv bash
set -o errexit  # Exit script when a command exits with non-zero status
set -o errtrace # Exit on error inside any functions or sub-shells
set -o nounset  # Exit script on use of an undefined variable
set -o pipefail # Return exit status of the last command in the pipe that failed

# shellcheck disable=SC1091
# source /usr/lib/hassio-addons/base.sh

# npm run start
node server.js