from node:24

env DEBIAN_FRONTEND=noninteractive

run apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    python3-xdg \
    xvfb \
    x11vnc \
    openbox \
    procps \
    xdg-utils \
    x11-xserver-utils \
    && rm -rf /var/lib/apt/lists/*

run git clone https://github.com/novnc/noVNC.git /opt/novnc
run git clone https://github.com/novnc/websockify /opt/novnc/utils/websockify
run chmod +x /opt/novnc/utils/novnc_proxy

env DISPLAY=:99
env XDG_SESSION_TYPE=x11
env GDK_SCALE=1
env GDK_DPI_SCALE=1
env BROWSER_WINDOW_SIZE_WIDTH=1440
env BROWSER_WINDOW_SIZE_HEIGHT=1440
env SCREEN_COLOR_DEPTH_BITS=24
env NO_VNC_PORT=6080
env CHROME_DEBUG_PORT=9222

WORKDIR /app

# Copy package files
COPY ./package.json ./

# Install dependencies
RUN npm install
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy source files
COPY ./ ./

RUN npm run build
RUN npm rebuild sqlite3 --build-from-source

ENV STORAGE_PATH=/storage

EXPOSE 6080

# # Start the application
# CMD ["yarn", "start"]

CMD Xvfb "$DISPLAY" -screen 0 "${BROWSER_WINDOW_SIZE_WIDTH}x${BROWSER_WINDOW_SIZE_HEIGHT}x${SCREEN_COLOR_DEPTH_BITS}" -ac -nolisten tcp & \
    openbox --reconfigure && openbox-session & \
    bash scripts/x11-setup.sh & \
    x11vnc -display "$DISPLAY" -forever -shared -nopw -geometry "${BROWSER_WINDOW_SIZE_WIDTH}x${BROWSER_WINDOW_SIZE_HEIGHT}" -scale 1:1 -nomodtweak & \
    /opt/novnc/utils/novnc_proxy --vnc localhost:5900 --listen "$NO_VNC_PORT" & \
    yarn start