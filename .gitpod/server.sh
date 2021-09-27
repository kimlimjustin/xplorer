#!/bin/sh

echo "Do you want to develop the app or the site?"

echo "Respond with 'app' or 'site'"

read $yarn1

if ["$yarn1" = "app"]; then
    yarn
    yarn start
fi