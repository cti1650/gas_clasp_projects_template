#!/bin/bash

# Push the script to the server
clasp push

# Get the latest version of the script
# latest_version=$(clasp versions | awk 'NR>1{v=$1} END{print v}')

# Get the latest deployment of the script
latest_deployment=$(clasp deployments | awk 'NR>1{v=$2} END{print v}')

# Deploy the latest version of the script
clasp deploy --deploymentId $latest_deployment
