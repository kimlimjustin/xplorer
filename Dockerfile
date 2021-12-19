
FROM gitpod/workspace-full-vnc:latest

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