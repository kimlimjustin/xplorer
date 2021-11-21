# I am adding the VNC edition since if anyone wanted to develop the app rather than the docs, they definetely can do it with noVNC which is used here.
# I am using the latest version since that can help us stay updated with Gitpod+noVNC
FROM gitpod/workspace-full-vnc:latest

# I got this from the GAUDC Project(not implemented yet, as told in #69, but the code is available on the fork.)
# Install custom tools, runtime, etc.
RUN sudo apt-get update \
    # window manager
    && sudo apt-get install -y jwm \
    # electron
    && sudo apt-get install -y libgtk-3-0 libnss3 libasound2 \
    # native-keymap
    && sudo apt-get install -y libx11-dev libxkbfile-dev
RUN sudo apt-get update \
    && sudo apt-get install -y \
        libasound2-dev \
        libgtk-3-dev \
        libnss3-dev
        
RUN sudo apt update && sudo apt install libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libappindicator3-dev \
    patchelf \
    librsvg2-dev
    
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.2/install.sh | bash

RUN nvm install node --latest-npm
RUN nvm use node
