#!/bin/sh
# A simple confirmation of which server the contributor wants to start
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
if ["$yarn1" = "site"]; then
	cd docs
	yarn
	yarn start
fi
# since the user hit control+c, they quit the terminal but now also know how to get it back.
echo "Exiting Server since you hit Ctrl+C... If you want the server to start again, type this: 'sudo sh .gitpod/server.sh' from the root directory."
exit
