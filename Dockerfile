# I am adding the VNC edition since if anyone wanted to develop the app rather than the docs, they definetely can do it with noVNC which is used here.
# I am using the latest version since that can help us stay updated with Gitpod+noVNC
FROM gitpod/workspace-full-vnc:latest

# I got this from the GAUDC Project(not implemented yet, as told in #69, but the code is available on the fork.)
# Install custom tools, runtime, etc.
RUN sudo apt-get update \
    # window manager
    && sudo apt-get install -y jwm \
    # native-keymap
    && sudo apt-get install -y libx11-dev libxkbfile-dev

# Tauri deps
RUN sudo DEBIAN_FRONTEND=noninteractive apt-get install -yq libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    libssl-dev \
    libgtk-3-dev \
    libappindicator3-dev \
    patchelf \
    librsvg2-dev
RUN sudo apt-get update \
    && sudo apt-get install -y \
        libasound2-dev \
        libgtk-3-dev \
        libnss3-dev