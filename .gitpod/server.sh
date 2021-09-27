#!/bin/sh
# Whenever you are starting a new thing, you must ask a question like this.
echo "Do you want to develop the app or the site?"
# This is needed since the shell script responds to only those keywords.
echo "Respond with 'app' or 'site'"
# The `read` command allows a person to add custom input, it doesn't save the input as an environment variable, rather, it saves them as temporary simple variables.
read $yarn1
# The If command is needed since it can determine specific commands for the server, whatever it may be.
if ["$yarn1" = "app"]; then
    yarn
    yarn start
fi